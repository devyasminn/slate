from dataclasses import dataclass
from typing import Optional

from .action import ActionType


GRID_SIZE = 32


def validate_grid_position(position: int) -> None:
    if type(position) is not int or not 0 <= position < GRID_SIZE:
        raise ValueError(f"Grid position must be an integer from 0 to {GRID_SIZE - 1}")


@dataclass
class Button:
    """Represents a button in the grid."""
    
    id: str
    label: str
    icon: str
    action_type: ActionType
    action_payload: Optional[dict] = None
    background: Optional[str] = None
    icon_color: Optional[str] = None
    grid_position: Optional[int] = None
    
    def to_dict(self) -> dict:
        """Convert button to dictionary for serialization."""
        result = {
            "id": self.id,
            "label": self.label,
            "icon": self.icon,
            "actionType": self.action_type.value,
            "actionPayload": self.action_payload,
            "gridPosition": self.grid_position,
        }
        # Include optional styling properties only if they are set
        if self.background is not None:
            result["background"] = self.background
        if self.icon_color is not None:
            result["iconColor"] = self.icon_color
        return result
    
    @classmethod
    def from_dict(cls, data: dict) -> "Button":
        """Create button from dictionary."""
        return cls(
            id=data["id"],
            label=data["label"],
            icon=data.get("icon", ""),
            action_type=ActionType(data["actionType"]),
            action_payload=data.get("actionPayload"),
            background=data.get("background"),
            icon_color=data.get("iconColor"),
            grid_position=data.get("gridPosition"),
        )

