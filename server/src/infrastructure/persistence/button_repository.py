"""Button repository using JSON file storage."""
import json
from dataclasses import replace
from pathlib import Path
from typing import Optional

from src.core.models import Button, ActionType
from src.core.interfaces.button_repository import ButtonConflictError
from src.core.models.button import GRID_SIZE, validate_grid_position


class ButtonRepository:
    """Repository for button data using JSON file storage."""
    
    def __init__(self, data_path: Path):
        self._data_path = data_path
        self._ensure_data_file()
    
    def _ensure_data_file(self) -> None:
        if not self._data_path.exists():
            self._data_path.parent.mkdir(parents=True, exist_ok=True)
            default_buttons = self._get_default_buttons()
            self._save_buttons(default_buttons)
    
    def _get_default_buttons(self) -> list[Button]:
        return [
            Button(
                id="media-prev",
                label="Previous",
                icon="skip-back",
                action_type=ActionType.MEDIA_PREV,
                grid_position=0,
            ),
            Button(
                id="media-play-pause",
                label="Play/Pause",
                icon="play",
                action_type=ActionType.MEDIA_PLAY_PAUSE,
                grid_position=1,
            ),
            Button(
                id="media-next",
                label="Next",
                icon="skip-forward",
                action_type=ActionType.MEDIA_NEXT,
                grid_position=2,
            ),
        ]
    
    def _save_buttons(self, buttons: list[Button]) -> None:
        data = {"buttons": [b.to_dict() for b in buttons]}
        with open(self._data_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    
    def _load_buttons(self) -> list[Button]:
        with open(self._data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        buttons = [Button.from_dict(b) for b in data.get("buttons", [])]
        occupied = set()
        for button in buttons:
            if button.grid_position is not None:
                validate_grid_position(button.grid_position)
                if button.grid_position in occupied:
                    raise ButtonConflictError(f"Grid position {button.grid_position} is already occupied")
                occupied.add(button.grid_position)

        for button in buttons:
            if button.grid_position is None:
                button.grid_position = self._first_free_position(occupied)
                occupied.add(button.grid_position)
        return buttons

    @staticmethod
    def _first_free_position(occupied: set[int]) -> int:
        position = next((cell for cell in range(GRID_SIZE) if cell not in occupied), None)
        if position is None:
            raise ButtonConflictError("The grid is full")
        return position
    
    def get_all(self) -> list[Button]:
        return self._load_buttons()
    
    def get_by_id(self, button_id: str) -> Optional[Button]:
        buttons = self._load_buttons()
        for button in buttons:
            if button.id == button_id:
                return button
        return None
    
    def save(self, button: Button) -> None:
        buttons = self._load_buttons()
        
        for i, b in enumerate(buttons):
            if b.id == button.id:
                buttons[i] = replace(button, grid_position=b.grid_position)
                break
        else:
            occupied = {b.grid_position for b in buttons if b.grid_position is not None}
            position = button.grid_position
            if position is None:
                position = self._first_free_position(occupied)
            validate_grid_position(position)
            if position in occupied:
                raise ButtonConflictError(f"Grid position {position} is already occupied")
            buttons.append(replace(button, grid_position=position))
        
        self._save_buttons(buttons)
    
    def delete(self, button_id: str) -> bool:
        """Returns True if deleted."""
        buttons = self._load_buttons()
        original_count = len(buttons)
        buttons = [b for b in buttons if b.id != button_id]
        
        if len(buttons) < original_count:
            self._save_buttons(buttons)
            return True
        return False
