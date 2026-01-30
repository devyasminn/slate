"""Button repository using SQLite database."""
import sqlite3
import json
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from src.core.models import Button, ActionType
from src.core.interfaces import ButtonRepository


class SQLiteButtonRepository(ButtonRepository):
    """Repository for button data using SQLite database."""
    
    def __init__(self, db_path: Path):
        self._db_path = db_path
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        return sqlite3.connect(self._db_path)
    
    def get_all(self, profile_id: str) -> List[Button]:
        """Get all buttons for a profile."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, label, icon, action_type, action_payload, 
                   background, icon_color, order_index
            FROM buttons
            WHERE profile_id = ?
            ORDER BY order_index ASC
        """, (profile_id,))
        
        buttons = []
        for row in cursor.fetchall():
            button_id, label, icon, action_type_str, action_payload_str, background, icon_color, order_index = row
            
            action_payload = None
            if action_payload_str:
                try:
                    action_payload = json.loads(action_payload_str)
                except json.JSONDecodeError:
                    action_payload = None
            
            buttons.append(Button(
                id=button_id,
                label=label,
                icon=icon,
                action_type=ActionType(action_type_str),
                action_payload=action_payload,
                background=background,
                icon_color=icon_color,
            ))
        
        conn.close()
        return buttons
    
    def get_by_id(self, button_id: str, profile_id: str) -> Optional[Button]:
        """Get button by ID and profile."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, label, icon, action_type, action_payload, 
                   background, icon_color, order_index
            FROM buttons
            WHERE id = ? AND profile_id = ?
        """, (button_id, profile_id))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        button_id, label, icon, action_type_str, action_payload_str, background, icon_color, order_index = row
        
        action_payload = None
        if action_payload_str:
            try:
                action_payload = json.loads(action_payload_str)
            except json.JSONDecodeError:
                action_payload = None
        
        return Button(
            id=button_id,
            label=label,
            icon=icon,
            action_type=ActionType(action_type_str),
            action_payload=action_payload,
            background=background,
            icon_color=icon_color,
        )
    
    def save(self, button: Button, profile_id: str) -> None:
        """Save or update a button."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) FROM buttons
            WHERE id = ? AND profile_id = ?
        """, (button.id, profile_id))
        
        exists = cursor.fetchone()[0] > 0
        now = datetime.now().isoformat()
        
        action_payload_str = json.dumps(button.action_payload) if button.action_payload else None
        
        if exists:
            # Update existing button
            cursor.execute("""
                UPDATE buttons
                SET label = ?, icon = ?, action_type = ?, action_payload = ?,
                    background = ?, icon_color = ?, updated_at = ?
                WHERE id = ? AND profile_id = ?
            """, (
                button.label,
                button.icon,
                button.action_type.value,
                action_payload_str,
                button.background,
                button.icon_color,
                now,
                button.id,
                profile_id,
            ))
        else:
            cursor.execute("""
                SELECT COALESCE(MAX(order_index), -1) FROM buttons
                WHERE profile_id = ?
            """, (profile_id,))
            max_order = cursor.fetchone()[0]
            order_index = max_order + 1
            
            cursor.execute("""
                INSERT INTO buttons (
                    id, profile_id, label, icon, action_type, action_payload,
                    background, icon_color, order_index, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                button.id,
                profile_id,
                button.label,
                button.icon,
                button.action_type.value,
                action_payload_str,
                button.background,
                button.icon_color,
                order_index,
                now,
                now,
            ))
        
        conn.commit()
        conn.close()
    
    def delete(self, button_id: str, profile_id: str) -> bool:
        """Delete a button. Returns True if deleted."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM buttons
            WHERE id = ? AND profile_id = ?
        """, (button_id, profile_id))
        
        deleted = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return deleted
    
    def reorder(self, button_ids: List[str], profile_id: str) -> None:
        """Reorder buttons based on the provided list of IDs."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        for idx, button_id in enumerate(button_ids):
            cursor.execute("""
                UPDATE buttons
                SET order_index = ?, updated_at = ?
                WHERE id = ? AND profile_id = ?
            """, (
                idx,
                datetime.now().isoformat(),
                button_id,
                profile_id,
            ))
        
        conn.commit()
        conn.close()
    
    def save_all(self, buttons: List[Button], profile_id: str) -> None:
        """Replace all buttons for a profile with the provided list."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM buttons WHERE profile_id = ?", (profile_id,))
        
        now = datetime.now().isoformat()
        for idx, button in enumerate(buttons):
            action_payload_str = json.dumps(button.action_payload) if button.action_payload else None
            
            cursor.execute("""
                INSERT INTO buttons (
                    id, profile_id, label, icon, action_type, action_payload,
                    background, icon_color, order_index, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                button.id,
                profile_id,
                button.label,
                button.icon,
                button.action_type.value,
                action_payload_str,
                button.background,
                button.icon_color,
                idx,
                now,
                now,
            ))
        
        conn.commit()
        conn.close()

