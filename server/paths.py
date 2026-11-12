"""
Path resolution for development and production environments.

In development: Uses local ./data directory relative to the project.
In production (frozen executable): Uses OS-appropriate user data directory.
SLATE_DATA_DIR overrides both; QA requires an explicitly prepared session directory.
"""
import os
import sys
from pathlib import Path
from platformdirs import user_data_dir
from uuid import UUID

APP_NAME = "Slate"
APP_AUTHOR = "Slate"


def is_frozen() -> bool:
    """Check if running as a frozen executable (PyInstaller, cx_Freeze, etc.)."""
    return getattr(sys, 'frozen', False)


def get_data_dir() -> Path:
    """
    Get the appropriate data directory based on environment.
    
    Development: ./data (relative to project)
    Production: OS user data directory (e.g., %LOCALAPPDATA%/Slate on Windows)
    """
    development = Path(getattr(sys, "_slate_development_data_dir", Path(__file__).parent / "data"))
    personal = Path(user_data_dir(APP_NAME, appauthor=False))
    override = os.environ.get("SLATE_DATA_DIR")
    qa = os.environ.get("SLATE_ENV", "").strip().lower() == "qa"
    if getattr(sys, "_slate_qa_build", False) and not qa:
        raise ValueError("This QA sidecar requires SLATE_ENV=qa; use npm run editor:qa")
    # A session marker must never be ignored because SLATE_ENV was lost/mistyped.
    if os.environ.get("SLATE_QA_SESSION") and not qa:
        raise ValueError("SLATE_QA_SESSION requires SLATE_ENV=qa")
    if qa:
        session = os.environ.get("SLATE_QA_SESSION", "")
        try:
            if str(UUID(session)) != session:
                raise ValueError()
        except ValueError:
            raise ValueError("QA requires a UUID SLATE_QA_SESSION") from None
        if not override or not Path(override).is_absolute():
            raise ValueError("QA requires an absolute SLATE_DATA_DIR; use npm run editor:qa")
        data_dir = Path(override).resolve()
        for protected in (development.resolve(), personal.resolve()):
            if data_dir.is_relative_to(protected) or protected.is_relative_to(data_dir):
                raise ValueError("QA data directory overlaps normal Slate data")
        if data_dir.name != "data" or data_dir.parent.name != session:
            raise ValueError("QA data directory must be <session UUID>/data")
        marker = data_dir / ".slate-qa-session"
        if not marker.is_file() or marker.read_text(encoding="utf-8").strip() != session:
            raise ValueError("QA data directory has no matching session marker")
        # Reject redirected data files, including junctions and hard links, before SQLite/auth opens them.
        if Path(override).absolute() != data_dir:
            raise ValueError("QA data directory must not contain links or junctions")
        for entry in data_dir.iterdir():
            if (entry.is_symlink() or getattr(entry, "is_junction", lambda: False)()
                    or entry.resolve().parent != data_dir or entry.is_file() and entry.stat().st_nlink > 1):
                raise ValueError("QA data directory must not contain linked files")
        return data_dir
    if override is not None:
        if not override.strip():
            raise ValueError("SLATE_DATA_DIR must not be empty")
        return Path(override).expanduser().resolve()
    return personal if is_frozen() else development


def ensure_data_dir() -> Path:
    """Get data directory and ensure it exists."""
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir
