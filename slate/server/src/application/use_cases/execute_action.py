"""Execute Action use case."""
from typing import Optional

from src.core.models import ActionType, Button
from src.core.interfaces import ActionExecutor


class ExecuteActionUseCase:
    """Use case for executing an action associated with a button."""
    
    def __init__(self, executor_registry: dict[ActionType, ActionExecutor]):
        self._executor_registry = executor_registry
    
    def execute(self, button: Button) -> dict:
        """Returns dict with keys: buttonId, status, message."""
        executor = self._executor_registry.get(button.action_type)
        
        if not executor:
            return {
                "buttonId": button.id,
                "status": "error",
                "message": f"No executor found for action type: {button.action_type.value}",
            }
        
        try:
            result = executor.execute(button.action_type, button.action_payload)
            return {
                "buttonId": button.id,
                "status": result.get("status", "success"),
                "message": result.get("message", "Action executed"),
            }
        except Exception as e:
            return {
                "buttonId": button.id,
                "status": "error",
                "message": str(e),
            }
