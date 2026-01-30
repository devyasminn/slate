"""Button repository using JSON file storage."""
import json
from pathlib import Path
from typing import Optional

from src.core.models import Button, ActionType


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
            ),
            Button(
                id="media-play-pause",
                label="Play/Pause",
                icon="play",
                action_type=ActionType.MEDIA_PLAY_PAUSE,
            ),
            Button(
                id="media-next",
                label="Next",
                icon="skip-forward",
                action_type=ActionType.MEDIA_NEXT,
            ),
        ]
    
    def _save_buttons(self, buttons: list[Button]) -> None:
        data = {"buttons": [b.to_dict() for b in buttons]}
        with open(self._data_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    
    def _load_buttons(self) -> list[Button]:
        with open(self._data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [Button.from_dict(b) for b in data.get("buttons", [])]
    
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
        
        found = False
        for i, b in enumerate(buttons):
            if b.id == button.id:
                buttons[i] = button
                found = True
                break
        
        if not found:
            buttons.append(button)
        
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
    
    def reorder(self, button_ids: list[str]) -> None:
        """Reorder buttons based on the provided list of IDs."""
        buttons = self._load_buttons()
        button_map = {b.id: b for b in buttons}
        
        reordered = []
        for bid in button_ids:
            if bid in button_map:
                reordered.append(button_map[bid])
        
        # Append any buttons not in the provided list at the end
        existing_ids = set(button_ids)
        for button in buttons:
            if button.id not in existing_ids:
                reordered.append(button)
        
        self._save_buttons(reordered)
    
    def save_all(self, buttons: list[Button]) -> None:
        """Replace all buttons with the provided list."""
        self._save_buttons(buttons)
