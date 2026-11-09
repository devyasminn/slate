"""Database initialization and migration utilities."""
import sqlite3
from contextlib import closing
from pathlib import Path

from src.core.models.button import GRID_SIZE


# NULL frees a cell temporarily within a swap transaction. The repository
# assigns a valid position to every button before committing a write.
GRID_POSITION_COLUMN = (
    f"grid_position INTEGER CHECK (typeof(grid_position) = 'integer' "
    f"AND grid_position BETWEEN 0 AND {GRID_SIZE - 1} OR grid_position IS NULL)"
)


def init_database(db_path: Path) -> None:
    """Initialize the SQLite schema and migrate legacy button layouts once."""
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with closing(sqlite3.connect(db_path)) as conn, conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute(f"""
            CREATE TABLE IF NOT EXISTS buttons (
                id TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                label TEXT NOT NULL,
                icon TEXT NOT NULL,
                action_type TEXT NOT NULL,
                action_payload TEXT,
                background TEXT,
                icon_color TEXT,
                {GRID_POSITION_COLUMN},
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id, profile_id),
                FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
            )
        """)

        columns = {row[1] for row in conn.execute("PRAGMA table_info(buttons)")}
        if "grid_position" not in columns:
            _migrate_positions(conn)

        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_buttons_grid_position
            ON buttons(profile_id, grid_position)
        """)


def _migrate_positions(conn: sqlite3.Connection) -> None:
    overflow = conn.execute("""
        SELECT profile_id, COUNT(*) FROM buttons
        GROUP BY profile_id HAVING COUNT(*) > ?
    """, (GRID_SIZE,)).fetchone()
    if overflow:
        profile_id, count = overflow
        raise RuntimeError(
            f"Cannot migrate profile {profile_id!r}: {count} buttons exceed the "
            f"{GRID_SIZE}-cell grid. Reduce the profile to {GRID_SIZE} buttons "
            "in the previous version before upgrading."
        )

    conn.execute(f"ALTER TABLE buttons ADD COLUMN {GRID_POSITION_COLUMN}")
    # The old (profile_id, order_index) index used rowid to break ties.
    conn.execute("""
        WITH ranked AS (
            SELECT rowid, ROW_NUMBER() OVER (
                PARTITION BY profile_id ORDER BY order_index, rowid
            ) - 1 AS position
            FROM buttons
        )
        UPDATE buttons SET grid_position = ranked.position
        FROM ranked WHERE buttons.rowid = ranked.rowid
    """)
    conn.execute("DROP INDEX IF EXISTS idx_buttons_order")
