"""Folder executor using os.startfile."""
import os
from typing import Optional
from pathlib import Path

from src.core.models import ActionType
from src.core.interfaces import ActionExecutor


class FolderExecutor(ActionExecutor):
    """Executor for opening folders."""
    
    @property
    def supported_actions(self) -> list[ActionType]:
        return [ActionType.OPEN_FOLDER]
    
    def execute(self, action_type: ActionType, payload: Optional[dict] = None) -> dict:
        if not payload or "path" not in payload:
            return {
                "status": "error",
                "message": "Missing 'path' in payload",
            }
        
        path_str = payload["path"]
        target_path: Path
        
        try:
            user_home = Path.home()
            if path_str.lower() == "downloads":
                target_path = user_home / "Downloads"
            elif path_str.lower() == "documents":
                target_path = user_home / "Documents"
            elif path_str.lower() == "desktop":
                target_path = user_home / "Desktop"
            elif path_str.lower() == "pictures":
                target_path = user_home / "Pictures"
            elif path_str.lower() == "music":
                target_path = user_home / "Music"
            elif path_str.lower() == "videos":
                target_path = user_home / "Videos"
            else:
                target_path = Path(path_str)
            
            target_path = target_path.resolve()
            
            if not target_path.exists():
                return {
                    "status": "error",
                    "message": f"Path does not exist: {target_path}",
                }
                
            if not target_path.is_dir():
                if target_path.is_file():
                    return {
                        "status": "error",
                        "message": f"Path is a file, not a directory: {target_path}. Use APP_LAUNCH action type for files.",
                    }
                return {
                    "status": "error",
                    "message": f"Path is not a directory: {target_path}",
                }

            os.startfile(target_path)
            
            return {
                "status": "success",
                "message": f"Opened folder: {target_path}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to open folder: {str(e)}",
            }
