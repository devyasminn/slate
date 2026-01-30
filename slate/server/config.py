import os
import sys
from pathlib import Path
from paths import ensure_data_dir

def is_frozen() -> bool:
    """Check if running as a frozen executable (PyInstaller)."""
    return getattr(sys, 'frozen', False)

# === Server ===
# === Server ===
# Sidecar mode: bind to 0.0.0.0 to allow mobile/network connections
HOST = "0.0.0.0"
PORT = 8000

# === Paths ===
if is_frozen():
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    BASE_DIR = Path(getattr(sys, '_MEIPASS', os.getcwd()))
    CLIENT_DIST_DIR = BASE_DIR / "client" / "dist"
    IS_PRODUCTION = True
else:
    BASE_DIR = Path(__file__).parent
    CLIENT_DIST_DIR = BASE_DIR.parent / "client" / "dist"
    # In dev, we check if the dist exists to decide if we serve it
    IS_PRODUCTION = CLIENT_DIST_DIR.exists()

DATA_DIR = ensure_data_dir()
TOKENS_FILE = DATA_DIR / "tokens.json"
DATABASE_FILE = DATA_DIR / "slate.db"

# === WebSocket ===
PING_INTERVAL_SECONDS = 30
PONG_TIMEOUT_SECONDS = 90

# === Development ===
DEV_CLIENT_PORT = 5173
DEV_EDITOR_PORT = 1420

# === Identity (lifecycle management) ===
OWNER = os.getenv("SLATE_OWNER", "standalone")
ENV = os.getenv("SLATE_ENV", "prod" if is_frozen() else "dev")
