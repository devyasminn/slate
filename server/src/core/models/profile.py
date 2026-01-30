from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Profile:
    """Represents a profile containing a set of buttons."""
    
    id: str
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> dict:
        """Convert profile to dictionary for serialization."""
        result = {
            "id": self.id,
            "name": self.name,
        }
        if self.created_at:
            result["createdAt"] = self.created_at.isoformat()
        if self.updated_at:
            result["updatedAt"] = self.updated_at.isoformat()
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "Profile":
        """Create profile from dictionary."""
        created_at = None
        updated_at = None
        
        if "createdAt" in data:
            created_at = datetime.fromisoformat(data["createdAt"])
        if "updatedAt" in data:
            updated_at = datetime.fromisoformat(data["updatedAt"])
        
        return cls(
            id=data["id"],
            name=data["name"],
            created_at=created_at,
            updated_at=updated_at,
        )














