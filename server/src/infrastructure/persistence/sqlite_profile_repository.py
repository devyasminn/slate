"""Profile repository using SQLite database."""
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from src.core.models import Button, Profile
from src.core.interfaces import ProfileRepository
from .sqlite_button_repository import SQLiteButtonRepository


class SQLiteProfileRepository(ProfileRepository):
    """Repository for profile data using SQLite database."""
    
    def __init__(self, db_path: Path):
        self._db_path = db_path
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        return sqlite3.connect(self._db_path)
    
    def get_all(self) -> List[Profile]:
        """Get all profiles."""
        with closing(self._get_connection()) as conn:
            return self._read_profiles(conn)

    @staticmethod
    def _read_profiles(conn: sqlite3.Connection) -> list[Profile]:
        rows = conn.execute("""
            SELECT id, name, created_at, updated_at
            FROM profiles
            ORDER BY created_at ASC
        """)
        return [SQLiteProfileRepository._to_profile(row) for row in rows]

    @staticmethod
    def _to_profile(row) -> Profile:
        profile_id, name, created_at, updated_at = row
        return Profile(
            id=profile_id,
            name=name,
            created_at=datetime.fromisoformat(created_at) if created_at else None,
            updated_at=datetime.fromisoformat(updated_at) if updated_at else None,
        )

    def get_by_id(self, profile_id: str) -> Optional[Profile]:
        """Get profile by ID."""
        with closing(self._get_connection()) as conn:
            return self._read_profile(conn, profile_id)

    @classmethod
    def _read_profile(cls, conn: sqlite3.Connection, profile_id: str) -> Profile | None:
        row = conn.execute("""
            SELECT id, name, created_at, updated_at
            FROM profiles
            WHERE id = ?
        """, (profile_id,)).fetchone()
        return cls._to_profile(row) if row else None

    def get_with_buttons(self, profile_id: str) -> tuple[Profile, list[Button]] | None:
        with closing(self._get_connection()) as conn, conn:
            conn.row_factory = sqlite3.Row
            conn.execute("BEGIN")
            profile = self._read_profile(conn, profile_id)
            if profile is None:
                return None
            return profile, SQLiteButtonRepository.read_profile_buttons(conn, profile_id)

    def create(self, profile: Profile) -> Profile:
        """Create a new profile."""
        with closing(self._get_connection()) as conn, conn:
            self._insert_profile(conn, profile)
        return profile

    @staticmethod
    def _insert_profile(conn: sqlite3.Connection, profile: Profile) -> None:
        now = datetime.now()
        profile.created_at = now
        profile.updated_at = now

        conn.execute("""
            INSERT INTO profiles (id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        """, (
            profile.id,
            profile.name,
            profile.created_at.isoformat(),
            profile.updated_at.isoformat(),
        ))

    def import_profile(self, profile: Profile, buttons: list[Button]) -> list[Profile]:
        with closing(self._get_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            existing_names = {name.casefold() for (name,) in conn.execute("SELECT name FROM profiles")}
            original = profile.name
            suffix = 1
            while profile.name.casefold() in existing_names:
                label = "Imported" if suffix == 1 else f"Imported {suffix}"
                profile.name = f"{original} ({label})"
                suffix += 1

            self._insert_profile(conn, profile)
            for button in buttons:
                SQLiteButtonRepository.insert_button(conn, button, profile.id)
            return self._read_profiles(conn)
    
    def update(self, profile: Profile) -> Profile:
        """Update an existing profile."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        profile.updated_at = datetime.now()
        
        cursor.execute("""
            UPDATE profiles
            SET name = ?, updated_at = ?
            WHERE id = ?
        """, (
            profile.name,
            profile.updated_at.isoformat(),
            profile.id,
        ))
        
        conn.commit()
        conn.close()
        
        return profile
    
    def delete(self, profile_id: str) -> bool:
        """Delete a profile. Returns True if deleted."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return deleted
    
    def get_default_profile(self) -> Optional[Profile]:
        """Get the default profile (first profile by creation date)."""
        profiles = self.get_all()
        return profiles[0] if profiles else None

