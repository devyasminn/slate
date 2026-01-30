"""Database initialization and migration utilities."""
import sqlite3
from pathlib import Path


def init_database(db_path: Path) -> None:
    """Initialize SQLite database with required tables."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS buttons (
            id TEXT NOT NULL,
            profile_id TEXT NOT NULL,
            label TEXT NOT NULL,
            icon TEXT NOT NULL,
            action_type TEXT NOT NULL,
            action_payload TEXT,
            background TEXT,
            icon_color TEXT,
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id, profile_id),
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        )
    """)
    
    # Create index for faster queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_buttons_profile_id 
        ON buttons(profile_id)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_buttons_order 
        ON buttons(profile_id, order_index)
    """)
    
    conn.commit()
    conn.close()

















