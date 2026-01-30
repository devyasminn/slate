"""Abstract interface for action executors."""
from abc import ABC, abstractmethod
from typing import Optional

from ..models.action import ActionType


class ActionExecutor(ABC):
    """Abstract base class for action executors."""
    
    @property
    @abstractmethod
    def supported_actions(self) -> list[ActionType]:
        pass
    
    @abstractmethod
    def execute(self, action_type: ActionType, payload: Optional[dict] = None) -> dict:
        """
        Args:
            action_type: The type of action to execute
            payload: Optional additional data for the action
            
        Returns:
            dict with keys: status ("success" | "error"), message (str)
        """
        pass
