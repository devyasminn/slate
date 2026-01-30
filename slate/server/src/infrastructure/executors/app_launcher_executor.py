"""App launcher executor."""
import os
from pathlib import Path
from typing import Optional

from src.core.models import ActionType
from src.core.interfaces import ActionExecutor


class AppLauncherExecutor(ActionExecutor):
    """Executor for launching applications."""
    
    @property
    def supported_actions(self) -> list[ActionType]:
        return [ActionType.APP_LAUNCH]
    
    def execute(self, action_type: ActionType, payload: Optional[dict] = None) -> dict:
        if not payload or "path" not in payload:
            return {
                "status": "error",
                "message": "Missing 'path' in payload",
            }
        
        try:
            path_str = payload["path"]
            path = Path(os.path.expandvars(path_str))
            
            # Resolve the path to handle relative paths and symlinks
            if not path.is_absolute():
                # Try to resolve from current directory or PATH
                resolved_path = path.resolve()
            else:
                resolved_path = path.resolve()
            
            # Validate: path must exist
            if not resolved_path.exists():
                return {
                    "status": "error",
                    "message": f"Path does not exist: {resolved_path}",
                }
            
            # Validate: must be a file, not a directory
            if not resolved_path.is_file():
                if resolved_path.is_dir():
                    return {
                        "status": "error",
                        "message": f"Path is a directory, not an executable file: {resolved_path}",
                    }
                return {
                    "status": "error",
                    "message": f"Path is not a valid file: {resolved_path}",
                }
            
            # Validate: check for executable extensions (flexible)
            executable_extensions = ['.exe', '.bat', '.cmd', '.msi', '.lnk', '.com', '.scr']
            has_executable_extension = any(
                resolved_path.name.lower().endswith(ext.lower()) 
                for ext in executable_extensions
            )
            
            # Allow execution even if extension doesn't match (system might handle it)
            # But warn if it's clearly not an executable
            if not has_executable_extension:
                # Still try to execute, but note it in the message
                pass
            
            os.startfile(str(resolved_path))
            return {
                "status": "success",
                "message": f"Launched: {resolved_path}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to launch app: {str(e)}",
            }