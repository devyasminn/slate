"""Persistence and migration tests for button positions."""
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from main import build_app
from src.core.interfaces.button_repository import ButtonConflictError
from src.infrastructure.persistence import SQLiteButtonRepository, init_database


@pytest.fixture
def legacy_db(tmp_path):
    path = tmp_path / "legacy.db"
    with closing(sqlite3.connect(path)) as conn, conn:
        conn.executescript("""
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY, name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE buttons (
                id TEXT NOT NULL, profile_id TEXT NOT NULL, label TEXT NOT NULL,
                icon TEXT NOT NULL, action_type TEXT NOT NULL, action_payload TEXT,
                background TEXT, icon_color TEXT, order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id, profile_id), FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_buttons_order ON buttons(profile_id, order_index);
            INSERT INTO profiles (id, name) VALUES ('one', 'First'), ('two', 'Second');
            INSERT INTO buttons (id, profile_id, label, icon, action_type, action_payload, background, icon_color, order_index)
            VALUES ('styled', 'one', 'Styled', 'fa-home', 'OPEN_URL', '{"url":"https://example.com"}', '#123', '#fff', 7),
                   ('z-tied', 'one', 'First tie', '', 'MEDIA_NEXT', NULL, NULL, NULL, -2),
                   ('a-tied', 'one', 'Second tie', '', 'SYSTEM_CPU', NULL, NULL, NULL, -2),
                   ('styled', 'two', 'Same ID', '', 'MEDIA_PREV', NULL, NULL, NULL, 90);
        """)
    return path


def test_migration_preserves_order_and_data_then_keeps_sparse_positions(legacy_db, tmp_path):
    tokens = tmp_path / "tokens.json"
    client = TestClient(build_app(legacy_db, tokens, testing=True))
    migrated = client.get("/api/profiles/one/buttons").json()["buttons"]
    assert [(b["id"], b["gridPosition"]) for b in migrated] == [
        ("z-tied", 0), ("a-tied", 1), ("styled", 2),
    ]
    styled = migrated[-1]
    assert styled == {
        "id": "styled", "label": "Styled", "icon": "fa-home", "actionType": "OPEN_URL",
        "actionPayload": {"url": "https://example.com"}, "background": "#123", "iconColor": "#fff",
        "gridPosition": 2,
    }
    assert client.put("/api/buttons/styled/position?profileId=one", json={
        "fromPosition": 2, "gridPosition": 30, "targetButtonId": None,
    }).status_code == 200
    assert client.delete("/api/buttons/z-tied?profileId=one").status_code == 200

    init_database(legacy_db)
    restarted = TestClient(build_app(legacy_db, tokens, testing=True))
    assert restarted.get("/api/profiles/one/buttons").json()["buttons"] == [
        migrated[1], {**styled, "gridPosition": 30},
    ]
    assert restarted.get("/api/buttons/styled?profileId=two").json()["gridPosition"] == 0


def test_over_capacity_migration_leaves_legacy_database_intact(legacy_db):
    with closing(sqlite3.connect(legacy_db)) as conn, conn:
        conn.executemany("""
            INSERT INTO buttons (id, profile_id, label, icon, action_type)
            VALUES (?, 'one', 'Extra', '', 'MEDIA_NEXT')
        """, [(f"extra-{i}",) for i in range(30)])

    with pytest.raises(RuntimeError, match="profile 'one': 33 buttons"):
        init_database(legacy_db)

    with closing(sqlite3.connect(legacy_db)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM buttons").fetchone()[0] == 34
        assert "grid_position" not in {row[1] for row in conn.execute("PRAGMA table_info(buttons)")}


def test_swap_rolls_back_if_final_write_fails(legacy_db):
    init_database(legacy_db)
    repository = SQLiteButtonRepository(legacy_db)
    before = repository.get_all("one")
    with closing(sqlite3.connect(legacy_db)) as conn, conn:
        conn.execute("""
            CREATE TRIGGER fail_final_swap BEFORE UPDATE OF grid_position ON buttons
            WHEN NEW.id = 'styled' AND NEW.grid_position = 0
            BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END
        """)

    with pytest.raises(sqlite3.IntegrityError, match="simulated write failure"):
        repository.move("z-tied", "one", 0, 2, "styled")
    assert repository.get_all("one") == before


def test_competing_moves_to_the_same_empty_cell_conflict(legacy_db):
    init_database(legacy_db)
    repository = SQLiteButtonRepository(legacy_db)

    def move(button_id, source):
        try:
            return repository.move(button_id, "one", source, 31, None)
        except ButtonConflictError:
            return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(move, "z-tied", 0)
        second = pool.submit(move, "a-tied", 1)
        assert sorted((first.result(), second.result())) == [False, True]

    assert [b.grid_position for b in repository.get_all("one")] in ([0, 2, 31], [1, 2, 31])
