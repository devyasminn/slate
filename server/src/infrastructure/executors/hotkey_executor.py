"""Hotkey executor using pyautogui."""
from typing import Optional
import pyautogui

from src.core.models import ActionType
from src.core.interfaces import ActionExecutor


class HotkeyExecutor(ActionExecutor):
    """Executor for hotkey actions."""
    
    @property
    def supported_actions(self) -> list[ActionType]:
        return [ActionType.HOTKEY]
    
    def execute(self, action_type: ActionType, payload: Optional[dict] = None) -> dict:
        if not payload or "hotkey" not in payload:
            return {
                "status": "error",
                "message": "Missing 'hotkey' in payload",
            }
        
        hotkey_str = payload["hotkey"]
        
        try:
            keys = [k.strip() for k in hotkey_str.split('+')]
            
            pyautogui.hotkey(*keys)
            return {
                "status": "success",
                "message": f"Hotkey executed: {hotkey_str}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to execute hotkey: {str(e)}",
            }
