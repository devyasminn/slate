"""
Path resolution for development and production environments.

In development: Uses local ./data directory relative to the project.
In production (frozen executable): Uses OS-appropriate user data directory.
"""
import sys
from pathlib import Path
from platformdirs import user_data_dir

APP_NAME = "Slate"
APP_AUTHOR = "Slate"


def is_frozen() -> bool:
    """Check if running as a frozen executable (PyInstaller, cx_Freeze, etc.)."""
    return getattr(sys, 'frozen', False)


def get_data_dir() -> Path:
    """
    Get the appropriate data directory based on environment.
    
    Development: ./data (relative to project)
    Production: OS user data directory (e.g., %APPDATA%/Slate on Windows)
    """
    if is_frozen():
        return Path(user_data_dir(APP_NAME, appauthor=False))
    else:
        return Path(__file__).parent / "data"


def ensure_data_dir() -> Path:
    """Get data directory and ensure it exists."""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir
