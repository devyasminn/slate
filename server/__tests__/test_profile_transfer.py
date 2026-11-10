import sqlite3
from contextlib import closing
from uuid import UUID

import pytest

from src.application.profile_transfer import MAX_PROFILE_BYTES


IMPORT = "/api/profiles/import"
PREVIEW = f"{IMPORT}/preview"


def portable(*buttons, name="Studio"):
    return {
        "format": "slate-profile",
        "version": 1,
        "profile": {"name": name},
        "buttons": list(buttons),
    }


def button(position, action="MEDIA_NEXT", **fields):
    return {"label": action, "actionType": action, "gridPosition": position, **fields}


def saved_buttons(client, profile_id):
    return client.get(f"/api/profiles/{profile_id}/buttons").json()["buttons"]


def test_round_trip_preserves_sparse_configuration_and_assigns_fresh_ids(client):
    original = client.post("/api/profiles", json={"name": "Studio 🎛"}).json()["profile"]
    configurations = [
        button(31, "APP_LAUNCH", actionPayload={"path": " C:\\Slate Tools\\tool.exe "}),
        button(0, "OPEN_URL", actionPayload={"url": "https://example.test/é", "options": ["one", 2]},
               label="Work", icon="solid:globe", background="linear-gradient(45deg, #012345, #abcdef)",
               iconColor="#ffffff"),
        button(7, "OPEN_FOLDER", actionPayload={"path": r"\\server\shared\folder"}),
        button(10, "HOTKEY", actionPayload={"hotkey": "ctrl+shift+s"}),
        button(18, "SYSTEM_CPU", background="#012345"),
        button(21),
    ]
    for i, config in enumerate(configurations):
        response = client.post("/api/buttons", params={"profileId": original["id"]},
                               json={"id": f"original-{i}", **config})
        assert response.status_code == 200

    saved = saved_buttons(client, original["id"])
    exported = client.get(f"/api/profiles/{original['id']}/export")
    assert exported.status_code == 200
    assert exported.json() == portable(
        *({key: value for key, value in item.items() if key != "id"} for item in saved),
        name=original["name"],
    )
    assert [item["gridPosition"] for item in exported.json()["buttons"]] == [0, 7, 10, 18, 21, 31]

    assert client.post(PREVIEW, content=exported.content).json() == {"name": original["name"], "buttonCount": 6}
    assert client.get("/api/profiles").json() == {"profiles": [original]}
    response = client.post(IMPORT, content=exported.content)
    assert response.status_code == 200
    restored = response.json()["profile"]
    assert restored["name"] == f"{original['name']} (Imported)"
    assert restored["id"] != original["id"]
    assert UUID(restored["id"]).version == 4
    assert response.json()["profiles"] == [original, restored]

    restored_buttons = saved_buttons(client, restored["id"])
    new_ids = {item["id"] for item in restored_buttons}
    assert len(new_ids) == len(saved)
    assert all(UUID(id_).version == 4 for id_ in new_ids)
    assert new_ids.isdisjoint(item["id"] for item in saved)
    reexported = client.get(f"/api/profiles/{restored['id']}/export").json()
    assert reexported == {**exported.json(), "profile": {"name": restored["name"]}}
    assert saved_buttons(client, original["id"]) == saved
    assert client.post(IMPORT, content=exported.content).json()["profile"]["name"] == f"{original['name']} (Imported 2)"


def test_empty_profile_can_be_imported_and_exported(client):
    data = portable(name="Empty")
    assert client.post(PREVIEW, json=data).json() == {"name": "Empty", "buttonCount": 0}
    response = client.post(IMPORT, json=data)
    assert response.status_code == 200
    profile = response.json()["profile"]
    assert client.get(f"/api/profiles/{profile['id']}/export").json() == data
    assert client.get("/api/profiles/missing/export").status_code == 404


@pytest.mark.parametrize(("data", "detail"), [
    ({**portable(), "format": "other"}, "not a Slate profile"),
    ({**portable(), "version": 2}, "Unsupported Slate profile version"),
    ({**portable(), "version": True}, "Unsupported Slate profile version"),
    (portable(name=14), "profile.name"),
    (portable(button(1, label=[])), "buttons.0.label"),
    (portable(button(1, background={})), "buttons.0.background"),
    (portable(button(1, "UNKNOWN")), "Unsupported action type"),
    (portable(button(1, "HOTKEY", actionPayload={"hotkey": 3})), "nonempty 'hotkey' string"),
    (portable(button(1, "OPEN_FOLDER", actionPayload={"path": " "})), "nonempty 'path' string"),
    (portable(button(1, "MEDIA_NEXT", actionPayload=[])), "buttons.0.actionPayload"),
    (portable(button(1), button(1)), "Multiple buttons occupy grid position 1"),
    (portable(*(button(i) for i in range(33))), "at most 32"),
    *[(portable(button(position)), "buttons.0.gridPosition") for position in [-1, 32, 1.5, "2", True]],
])
def test_preview_and_import_reject_invalid_profiles_without_writing(client, data, detail):
    for endpoint in (PREVIEW, IMPORT):
        response = client.post(endpoint, json=data)
        assert response.status_code == 422
        assert detail in response.json()["detail"]
    assert client.get("/api/profiles").json() == {"profiles": []}


@pytest.mark.parametrize("raw", [b"{", b"\xff", b"1e1000", b'"\\ud800"'])
def test_invalid_json(client, raw):
    for endpoint in (PREVIEW, IMPORT):
        response = client.post(endpoint, content=raw)
        assert response.status_code == 422
        assert "Invalid JSON" in response.json()["detail"]
    assert client.get("/api/profiles").json() == {"profiles": []}


def test_oversized_input_is_rejected(client):
    for endpoint in (PREVIEW, IMPORT):
        response = client.post(endpoint, content=b" " * (MAX_PROFILE_BYTES + 1))
        assert response.status_code == 413
        assert "1 MiB" in response.json()["detail"]
    assert client.get("/api/profiles").json() == {"profiles": []}


def test_import_rolls_back_profile_and_buttons_if_an_insert_fails(client, profile_id, tmp_path):
    with closing(sqlite3.connect(tmp_path / "test.db")) as conn, conn:
        conn.execute("""
            CREATE TRIGGER fail_second_button BEFORE INSERT ON buttons
            WHEN NEW.grid_position = 31
            BEGIN SELECT RAISE(ABORT, 'forced failure'); END
        """)
    before = client.get("/api/profiles").json()
    response = client.post(IMPORT, json=portable(button(0), button(31)))
    assert response.status_code == 500
    assert "Failed to save" in response.json()["detail"]
    assert client.get("/api/profiles").json() == before
    assert saved_buttons(client, profile_id) == []
    with closing(sqlite3.connect(tmp_path / "test.db")) as conn:
        assert conn.execute("SELECT COUNT(*) FROM buttons").fetchone() == (0,)


def test_import_broadcasts_profiles_and_switches_connected_clients(client, profile_id):
    with client:
        qr_token = client.get("/api/auth/qr-token").json()["qrToken"]
        token = client.post("/api/auth/exchange", params={"qrToken": qr_token}).json()["sessionToken"]
        with client.websocket_connect("/ws") as socket:
            socket.send_json({"type": "HELLO", "payload": {"version": "1.0", "token": token}})
            assert socket.receive_json()["type"] == "WELCOME"
            assert socket.receive_json()["payload"]["activeProfileId"] == profile_id
            assert socket.receive_json()["type"] == "BUTTONS_LIST"

            response = client.post(IMPORT, json=portable(button(29)))
            imported = response.json()["profile"]
            update = socket.receive_json()
            assert update["type"] == "PROFILES_LIST"
            assert imported in update["payload"]["profiles"]
            switched = socket.receive_json()
            assert switched["type"] == "PROFILE_SWITCHED"
            assert switched["payload"]["profileId"] == imported["id"]
            grid = socket.receive_json()
            assert grid["type"] == "BUTTONS_LIST"
            assert grid["payload"]["buttons"][0]["gridPosition"] == 29
