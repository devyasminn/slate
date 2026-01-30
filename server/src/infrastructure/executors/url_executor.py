"""URL executor using webbrowser."""
from typing import Optional
import webbrowser

from src.core.models import ActionType
from src.core.interfaces import ActionExecutor


class UrlExecutor(ActionExecutor):
    """Executor for opening URLs."""
    
    @property
    def supported_actions(self) -> list[ActionType]:
        return [ActionType.OPEN_URL]
    
    def execute(self, action_type: ActionType, payload: Optional[dict] = None) -> dict:
        if not payload or "url" not in payload:
            return {
                "status": "error",
                "message": "Missing 'url' in payload",
            }
        
        url = payload["url"]
        
        try:
            webbrowser.open(url)
            return {
                "status": "success",
                "message": f"Opened URL: {url}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to open URL: {str(e)}",
            }
