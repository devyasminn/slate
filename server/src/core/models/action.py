from enum import Enum


class ActionType(str, Enum):
    """Enumeration of all supported action types."""
    
    MEDIA_PLAY_PAUSE = "MEDIA_PLAY_PAUSE"
    MEDIA_NEXT = "MEDIA_NEXT"
    MEDIA_PREV = "MEDIA_PREV"
    APP_LAUNCH = "APP_LAUNCH"
    HOTKEY = "HOTKEY"
    OPEN_URL = "OPEN_URL"
    OPEN_FOLDER = "OPEN_FOLDER"
    VOLUME_UP = "VOLUME_UP"
    VOLUME_DOWN = "VOLUME_DOWN"
    VOLUME_MUTE = "VOLUME_MUTE"
    
    # System monitoring (display-only, no action execution)
    SYSTEM_CPU = "SYSTEM_CPU"
    SYSTEM_RAM = "SYSTEM_RAM"
    SYSTEM_GPU = "SYSTEM_GPU"
