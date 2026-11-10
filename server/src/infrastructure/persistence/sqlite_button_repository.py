"""Button repository using SQLite database."""
import json
import sqlite3
from contextlib import closing
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Optional

from src.core.interfaces import ButtonRepository
from src.core.interfaces.button_repository import ButtonConflictError
from src.core.models import ActionType, Button
from src.core.models.button import GRID_SIZE, validate_grid_position


class SQLiteButtonRepository(ButtonRepository):
    """Repository for button data using SQLite database."""

    def __init__(self, db_path: Path):
        self._db_path = db_path

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _to_button(row: sqlite3.Row) -> Button:
        try:
            action_payload = json.loads(row['action_payload']) if row['action_payload'] else None
        except json.JSONDecodeError:
            action_payload = None

        return Button(
            id=row['id'],
            label=row['label'],
            icon=row['icon'],
            action_type=ActionType(row['action_type']),
            action_payload=action_payload,
            background=row['background'],
            icon_color=row['icon_color'],
            grid_position=row['grid_position'],
        )

    def get_all(self, profile_id: str) -> list[Button]:
        with closing(self._get_connection()) as conn:
            return self.read_profile_buttons(conn, profile_id)

    @classmethod
    def read_profile_buttons(cls, conn: sqlite3.Connection, profile_id: str) -> list[Button]:
        rows = conn.execute("""
            SELECT * FROM buttons WHERE profile_id = ? ORDER BY grid_position
        """, (profile_id,))
        return [cls._to_button(row) for row in rows]

    @staticmethod
    def insert_button(conn: sqlite3.Connection, button: Button, profile_id: str) -> None:
        now = datetime.now().isoformat()
        conn.execute("""
            INSERT INTO buttons (
                id, profile_id, label, icon, action_type, action_payload,
                background, icon_color, grid_position, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            button.id, profile_id, button.label, button.icon, button.action_type.value,
            json.dumps(button.action_payload) if button.action_payload is not None else None,
            button.background, button.icon_color, button.grid_position, now, now,
        ))

    def get_by_id(self, button_id: str, profile_id: str) -> Optional[Button]:
        with closing(self._get_connection()) as conn:
            row = conn.execute("""
                SELECT * FROM buttons WHERE id = ? AND profile_id = ?
            """, (button_id, profile_id)).fetchone()
            return self._to_button(row) if row else None

    def create(self, button: Button, profile_id: str) -> Button:
        position = button.grid_position
        if position is not None:
            validate_grid_position(position)

        with closing(self._get_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            if not conn.execute("SELECT 1 FROM profiles WHERE id = ?", (profile_id,)).fetchone():
                raise LookupError("Profile not found")

            layout = dict(conn.execute(
                "SELECT grid_position, id FROM buttons WHERE profile_id = ?", (profile_id,),
            ))
            if button.id in layout.values():
                raise ButtonConflictError("Button with this ID already exists")
            if position is None:
                position = next((cell for cell in range(GRID_SIZE) if cell not in layout), None)
                if position is None:
                    raise ButtonConflictError("The profile's grid is full")
            elif position in layout:
                raise ButtonConflictError(f"Grid position {position} is already occupied")

            created = replace(button, grid_position=position)
            self.insert_button(conn, created, profile_id)
            return created

    def update(self, button: Button, profile_id: str) -> Button:
        with closing(self._get_connection()) as conn, conn:
            row = conn.execute("""
                UPDATE buttons
                SET label = ?, icon = ?, action_type = ?, action_payload = ?,
                    background = ?, icon_color = ?, updated_at = ?
                WHERE id = ? AND profile_id = ?
                RETURNING grid_position
            """, (
                button.label, button.icon, button.action_type.value,
                json.dumps(button.action_payload) if button.action_payload is not None else None,
                button.background, button.icon_color, datetime.now().isoformat(), button.id, profile_id,
            )).fetchone()
            if not row:
                raise LookupError("Button not found")
            return replace(button, grid_position=row['grid_position'])

    def delete(self, button_id: str, profile_id: str) -> bool:
        with closing(self._get_connection()) as conn, conn:
            result = conn.execute(
                "DELETE FROM buttons WHERE id = ? AND profile_id = ?", (button_id, profile_id),
            )
            return result.rowcount > 0

    def move(
        self, button_id: str, profile_id: str, from_position: int,
        to_position: int, target_button_id: Optional[str],
    ) -> bool:
        validate_grid_position(from_position)
        validate_grid_position(to_position)

        with closing(self._get_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            source = conn.execute("""
                SELECT grid_position FROM buttons WHERE id = ? AND profile_id = ?
            """, (button_id, profile_id)).fetchone()
            if not source:
                raise LookupError("Button not found")
            if source['grid_position'] != from_position:
                raise ButtonConflictError("The button has moved. Refresh the layout and try again.")
            if from_position == to_position:
                return False

            target = conn.execute("""
                SELECT id FROM buttons WHERE profile_id = ? AND grid_position = ?
            """, (profile_id, to_position)).fetchone()
            if (target['id'] if target else None) != target_button_id:
                raise ButtonConflictError("The destination has changed. Refresh the layout and try again.")

            now = datetime.now().isoformat()
            move_button = """
                UPDATE buttons SET grid_position = ?, updated_at = ? WHERE id = ? AND profile_id = ?
            """
            if target:
                # SQLite checks uniqueness on each update. Free the destination
                # before moving the source, then fill the vacated cell.
                conn.execute(move_button, (None, now, target_button_id, profile_id))
            conn.execute(move_button, (to_position, now, button_id, profile_id))
            if target:
                conn.execute(move_button, (from_position, now, target_button_id, profile_id))
            return True
