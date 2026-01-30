"""Media control executor using pyautogui."""
from typing import Optional
import pyautogui

from src.core.models import ActionType
from src.core.interfaces import ActionExecutor


class MediaExecutor(ActionExecutor):
    """Executor for media control actions (play/pause, next, previous, volume)."""
    
    _KEY_MAP = {
        ActionType.MEDIA_PLAY_PAUSE: "playpause",
        ActionType.MEDIA_NEXT: "nexttrack",
        ActionType.MEDIA_PREV: "prevtrack",
        ActionType.VOLUME_UP: "volumeup",
        ActionType.VOLUME_DOWN: "volumedown",
        ActionType.VOLUME_MUTE: "volumemute",
    }
    
    @property
    def supported_actions(self) -> list[ActionType]:
        return list(self._KEY_MAP.keys())
    
    def execute(self, action_type: ActionType, payload: Optional[dict] = None) -> dict:
        key = self._KEY_MAP.get(action_type)
        
        if not key:
            return {
                "status": "error",
                "message": f"Unknown media action: {action_type.value}",
            }
        
        try:
            pyautogui.press(key)
            return {
                "status": "success",
                "message": f"Media action executed: {action_type.value}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to execute media action: {str(e)}",
            }
