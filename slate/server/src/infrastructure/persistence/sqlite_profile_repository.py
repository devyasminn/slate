"""Profile repository using SQLite database."""
import sqlite3
import json
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from src.core.models import Profile
from src.core.interfaces import ProfileRepository


class SQLiteProfileRepository(ProfileRepository):
    """Repository for profile data using SQLite database."""
    
    def __init__(self, db_path: Path):
        self._db_path = db_path
    
    def _get_connection(self) -> sqlite3.Connection:
        """Get database connection."""
        return sqlite3.connect(self._db_path)
    
    def get_all(self) -> List[Profile]:
        """Get all profiles."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, created_at, updated_at
            FROM profiles
            ORDER BY created_at ASC
        """)
        
        profiles = []
        for row in cursor.fetchall():
            profile_id, name, created_at_str, updated_at_str = row
            created_at = datetime.fromisoformat(created_at_str) if created_at_str else None
            updated_at = datetime.fromisoformat(updated_at_str) if updated_at_str else None
            
            profiles.append(Profile(
                id=profile_id,
                name=name,
                created_at=created_at,
                updated_at=updated_at,
            ))
        
        conn.close()
        return profiles
    
    def get_by_id(self, profile_id: str) -> Optional[Profile]:
        """Get profile by ID."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, name, created_at, updated_at
            FROM profiles
            WHERE id = ?
        """, (profile_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return None
        
        profile_id, name, created_at_str, updated_at_str = row
        created_at = datetime.fromisoformat(created_at_str) if created_at_str else None
        updated_at = datetime.fromisoformat(updated_at_str) if updated_at_str else None
        
        return Profile(
            id=profile_id,
            name=name,
            created_at=created_at,
            updated_at=updated_at,
        )
    
    def create(self, profile: Profile) -> Profile:
        """Create a new profile."""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        now = datetime.now()
        profile.created_at = now
        profile.updated_at = now
        
        cursor.execute("""
            INSERT INTO profiles (id, name, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        """, (
            profile.id,
            profile.name,
            profile.created_at.isoformat(),
            profile.updated_at.isoformat(),
        ))
        
        conn.commit()
        conn.close()
        
        return profile
    
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

