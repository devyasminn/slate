"""Abstract interface for profile repositories."""
from abc import ABC, abstractmethod
from typing import Optional, List

from ..models import Button, Profile


class ProfileRepository(ABC):
    """Abstract base class for profile repositories.
    
    Defines the contract for profile persistence operations.
    Implementations can use SQLite, JSON files, in-memory storage, etc.
    """
    
    @abstractmethod
    def get_all(self) -> List[Profile]:
        """Get all profiles, ordered by creation date."""
        pass
    
    @abstractmethod
    def get_by_id(self, profile_id: str) -> Optional[Profile]:
        """Get a profile by its ID."""
        pass

    @abstractmethod
    def get_with_buttons(self, profile_id: str) -> tuple[Profile, list[Button]] | None:
        """Read a consistent snapshot of the saved profile and grid."""
        pass
    
    @abstractmethod
    def create(self, profile: Profile) -> Profile:
        """Create a new profile. Returns the created profile with timestamps."""
        pass

    @abstractmethod
    def import_profile(self, profile: Profile, buttons: list[Button]) -> list[Profile]:
        """Insert a new profile and grid atomically and return the refreshed profile list."""
        pass
    
    @abstractmethod
    def update(self, profile: Profile) -> Profile:
        """Update an existing profile. Returns the updated profile."""
        pass
    
    @abstractmethod
    def delete(self, profile_id: str) -> bool:
        """Delete a profile. Returns True if deleted."""
        pass
    
    @abstractmethod
    def get_default_profile(self) -> Optional[Profile]:
        """Get the default profile (typically the first one by creation date)."""
        pass
