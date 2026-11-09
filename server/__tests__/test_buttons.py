"""Tests for button endpoints."""
import pytest


def test_create_and_list_buttons(client, profile_id):
    """Create a button and verify it appears in the list."""
    payload = {
        "id": "btn-test-1",
        "label": "Test Button",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://example.com"},
    }
    
    # Create
    response = client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    assert response.status_code == 200
    assert response.json().get("status") == "created"
    assert response.json()["button"]["gridPosition"] == 0
    
    # List and verify
    response = client.get(f"/api/buttons?profileId={profile_id}")
    assert response.status_code == 200
    
    buttons = response.json()["buttons"]
    assert any(b["id"] == "btn-test-1" for b in buttons)


def test_update_button(client, profile_id):
    """Update a button's label."""
    # Setup: create button
    payload = {
        "id": "btn-update",
        "label": "Original",
        "gridPosition": 26,
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://old.com"},
    }
    client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    
    # Update
    payload["label"] = "Updated"
    payload["actionType"] = "SYSTEM_CPU"
    payload["actionPayload"] = None
    payload["gridPosition"] = 0  # A stale properties form cannot move the button.
    response = client.put(f"/api/buttons/btn-update?profileId={profile_id}", json=payload)
    
    assert response.status_code == 200
    assert response.json()["button"]["label"] == "Updated"
    assert response.json()["button"]["gridPosition"] == 26


def test_delete_button(client, profile_id):
    """Delete a button."""
    # Setup
    payload = {
        "id": "btn-delete",
        "label": "To Delete",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://delete.com"},
    }
    client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    
    # Delete
    response = client.delete(f"/api/buttons/btn-delete?profileId={profile_id}")
    
    assert response.status_code == 200
    assert response.json().get("status") == "deleted"


def test_duplicate_button_id_returns_409(client, profile_id):
    """
    Creating a button with duplicate ID returns 409 Conflict.
    
    Contract: routes.py raises HTTPException(status_code=409)
    """
    payload = {
        "id": "btn-dup",
        "label": "First",
        "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://first.com"},
    }
    
    # First creation succeeds
    response = client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    assert response.status_code == 200
    
    # Second creation with same ID fails with 409
    response = client.post(f"/api/buttons?profileId={profile_id}", json=payload)
    assert response.status_code == 409


def create_at(client, profile_id, button_id, position):
    return client.post("/api/buttons", params={"profileId": profile_id}, json={
        "id": button_id, "label": button_id, "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://example.com"}, "background": "#000", "gridPosition": position,
    })


def move_to(client, profile_id, button_id, source, target, occupant=None):
    return client.put(f"/api/buttons/{button_id}/position", params={"profileId": profile_id}, json={
        "fromPosition": source, "gridPosition": target, "targetButtonId": occupant,
    })


def positions(data):
    return {b["id"]: b["gridPosition"] for b in data["buttons"]}


def test_move_swap_and_delete_preserve_gaps(client, profile_id):
    first = create_at(client, profile_id, "first", 2).json()["button"]
    second = create_at(client, profile_id, "second", 9).json()["button"]
    unrelated = create_at(client, profile_id, "unrelated", 20).json()["button"]

    response = move_to(client, profile_id, "first", 2, 31)
    assert response.status_code == 200
    assert positions(response.json()) == {"first": 31, "second": 9, "unrelated": 20}

    response = move_to(client, profile_id, "first", 31, 9, "second")
    assert response.status_code == 200
    assert response.json()["buttons"] == [
        {**first, "gridPosition": 9}, unrelated, {**second, "gridPosition": 31},
    ]

    assert client.delete("/api/buttons/first", params={"profileId": profile_id}).status_code == 200
    assert positions(client.get("/api/buttons", params={"profileId": profile_id}).json()) == {
        "second": 31, "unrelated": 20,
    }


@pytest.mark.parametrize("invalid", [-1, 32, 1.5, "1", True])
def test_rejects_invalid_positions(client, profile_id, invalid):
    assert create_at(client, profile_id, "invalid", invalid).status_code == 422
    assert create_at(client, profile_id, "first", 2).status_code == 200
    assert move_to(client, profile_id, "first", invalid, 4).status_code == 422
    assert move_to(client, profile_id, "first", 2, invalid).status_code == 422
    assert positions(client.get(f"/api/profiles/{profile_id}/buttons").json()) == {"first": 2}


def test_conflicting_operations_preserve_layout(client, profile_id):
    assert create_at(client, profile_id, "first", 5).status_code == 200
    assert create_at(client, profile_id, "second", 10).status_code == 200
    assert create_at(client, profile_id, "third", 5).status_code == 409
    assert move_to(client, profile_id, "first", 4, 10, "second").status_code == 409
    assert move_to(client, profile_id, "first", 5, 10).status_code == 409
    assert move_to(client, profile_id, "first", 5, 11, "second").status_code == 409
    assert move_to(client, profile_id, "missing", 5, 10, "second").status_code == 404
    assert move_to(client, profile_id, "first", 5, 5).status_code == 200
    assert client.put("/api/buttons/reorder", json={"buttonIds": ["second", "first"]}).status_code == 422
    assert positions(client.get(f"/api/profiles/{profile_id}/buttons").json()) == {"first": 5, "second": 10}


def test_legacy_creation_uses_free_cells_and_full_grid_can_swap(client, profile_id):
    for position in range(1, 32):
        assert create_at(client, profile_id, f"button-{position}", position).status_code == 200
    legacy = {"id": "legacy", "label": "Legacy", "actionType": "MEDIA_NEXT"}
    response = client.post("/api/buttons", params={"profileId": profile_id}, json=legacy)
    assert response.json()["button"]["gridPosition"] == 0
    response = client.post("/api/buttons", params={"profileId": profile_id}, json={**legacy, "id": "overflow"})
    assert response.status_code == 409
    response = move_to(client, profile_id, "legacy", 0, 31, "button-31")
    assert response.status_code == 200
    assert positions(response.json()) == {
        **{f"button-{position}": position for position in range(1, 31)},
        "legacy": 31, "button-31": 0,
    }


def test_websocket_updates_only_clients_viewing_the_changed_profile(client, profile_id):
    with client:
        other_id = client.post("/api/profiles", json={"name": "Other"}).json()["profile"]["id"]
        assert create_at(client, profile_id, "same-id", 7).status_code == 200
        assert create_at(client, other_id, "same-id", 7).status_code == 200
        qr_token = client.get("/api/auth/qr-token").json()["qrToken"]
        token = client.post("/api/auth/exchange", params={"qrToken": qr_token}).json()["sessionToken"]

        with client.websocket_connect("/ws") as first, client.websocket_connect("/ws") as second:
            for socket in (first, second):
                socket.send_json({"type": "HELLO", "payload": {"version": "1.0", "token": token}})
                assert socket.receive_json()["type"] == "WELCOME"
                assert socket.receive_json()["payload"]["activeProfileId"] == profile_id
                assert positions(socket.receive_json()["payload"]) == {"same-id": 7}

            second.send_json({"type": "SWITCH_PROFILE", "payload": {"profileId": other_id}})
            assert positions(second.receive_json()["payload"]) == {"same-id": 7}
            assert second.receive_json()["type"] == "PROFILE_SWITCHED"

            assert move_to(client, profile_id, "same-id", 7, 24).status_code == 200
            first.send_json({"type": "GET_PROFILES", "payload": {}})
            update = first.receive_json()
            assert update["type"] == "BUTTONS_LIST"
            assert positions(update["payload"]) == {"same-id": 24}
            second.send_json({"type": "GET_BUTTONS", "payload": {}})
            assert positions(second.receive_json()["payload"]) == {"same-id": 7}

            assert client.delete(f"/api/profiles/{other_id}").status_code == 200
            second.send_json({"type": "GET_PROFILES", "payload": {}})
            assert second.receive_json()["payload"]["activeProfileId"] == profile_id
            update = second.receive_json()
            assert update["type"] == "BUTTONS_LIST"
            assert positions(update["payload"]) == {"same-id": 24}
