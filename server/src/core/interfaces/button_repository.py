"""Abstract interface for button repositories."""
from abc import ABC, abstractmethod
from typing import Optional, List

from ..models import Button


class ButtonConflictError(Exception):
    """The requested button or cell conflicts with the current layout."""


class ButtonRepository(ABC):
    """Abstract base class for button repositories.
    
    Defines the contract for button persistence operations.
    Implementations can use SQLite, JSON files, in-memory storage, etc.
    """
    
    @abstractmethod
    def get_all(self, profile_id: str) -> List[Button]:
        """Get all buttons for a profile, ordered by grid position."""
        pass
    
    @abstractmethod
    def get_by_id(self, button_id: str, profile_id: str) -> Optional[Button]:
        """Get a button by its ID within a profile."""
        pass
    
    @abstractmethod
    def create(self, button: Button, profile_id: str) -> Button:
        """Create in the requested cell, or the first free cell if unspecified."""
        pass

    @abstractmethod
    def update(self, button: Button, profile_id: str) -> Button:
        """Update button properties while preserving the saved position."""
        pass

    @abstractmethod
    def delete(self, button_id: str, profile_id: str) -> bool:
        """Delete a button. Returns True if deleted."""
        pass
    
    @abstractmethod
    def move(
        self, button_id: str, profile_id: str, from_position: int,
        to_position: int, target_button_id: Optional[str],
    ) -> bool:
        """Move or swap cells atomically, checking that both match the request."""
        pass
