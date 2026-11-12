import os
import sys
from pathlib import Path
from paths import get_data_dir

def is_frozen() -> bool:
    """Check if running as a frozen executable (PyInstaller)."""
    return getattr(sys, 'frozen', False)

# === Identity (validated before persistent data is opened) ===
OWNER = os.getenv("SLATE_OWNER", "standalone")
ENV = os.getenv("SLATE_ENV", "prod" if is_frozen() else "dev").strip().lower()
QA_SESSION = os.getenv("SLATE_QA_SESSION", "")
INSTANCE_ID = os.getenv("SLATE_INSTANCE_ID", "")
LIFECYCLE_TOKEN = os.getenv("SLATE_LIFECYCLE_TOKEN", "")
PARENT_PID = int(os.environ["SLATE_PARENT_PID"]) if "SLATE_PARENT_PID" in os.environ else None

# === Server ===
HOST = "127.0.0.1" if ENV.lower() == "qa" else "0.0.0.0"
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

DATA_DIR = get_data_dir()
if ENV.lower() == "qa" and (OWNER != "tauri" or not INSTANCE_ID or not LIFECYCLE_TOKEN or not PARENT_PID):
    raise ValueError("QA requires a Tauri-owned instance, lifecycle token, and parent process")
TOKENS_FILE = DATA_DIR / "tokens.json"
DATABASE_FILE = DATA_DIR / "slate.db"

# === WebSocket ===
PING_INTERVAL_SECONDS = 30
PONG_TIMEOUT_SECONDS = 90

# === Development ===
DEV_CLIENT_PORT = 5173
DEV_EDITOR_PORT = 1420
