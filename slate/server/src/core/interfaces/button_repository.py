"""Abstract interface for button repositories."""
from abc import ABC, abstractmethod
from typing import Optional, List

from ..models import Button


class ButtonRepository(ABC):
    """Abstract base class for button repositories.
    
    Defines the contract for button persistence operations.
    Implementations can use SQLite, JSON files, in-memory storage, etc.
    """
    
    @abstractmethod
    def get_all(self, profile_id: str) -> List[Button]:
        """Get all buttons for a profile, ordered by order_index."""
        pass
    
    @abstractmethod
    def get_by_id(self, button_id: str, profile_id: str) -> Optional[Button]:
        """Get a button by its ID within a profile."""
        pass
    
    @abstractmethod
    def save(self, button: Button, profile_id: str) -> None:
        """Save or update a button in a profile."""
        pass
    
    @abstractmethod
    def delete(self, button_id: str, profile_id: str) -> bool:
        """Delete a button. Returns True if deleted."""
        pass
    
    @abstractmethod
    def reorder(self, button_ids: List[str], profile_id: str) -> None:
        """Reorder buttons based on the provided list of IDs."""
        pass
    
    @abstractmethod
    def save_all(self, buttons: List[Button], profile_id: str) -> None:
        """Replace all buttons for a profile with the provided list."""
        pass
