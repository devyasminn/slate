"""Executor registry - maps action types to their executors."""
from src.core.models import ActionType
from src.core.interfaces import ActionExecutor

from .media_executor import MediaExecutor
from .app_launcher_executor import AppLauncherExecutor
from .hotkey_executor import HotkeyExecutor
from .url_executor import UrlExecutor
from .folder_executor import FolderExecutor


def create_executor_registry() -> dict[ActionType, ActionExecutor]:
    """Create and return the executor registry mapping ActionType to ActionExecutor."""
    registry: dict[ActionType, ActionExecutor] = {}
    
    executors: list[ActionExecutor] = [
        MediaExecutor(),
        AppLauncherExecutor(),
        HotkeyExecutor(),
        UrlExecutor(),
        FolderExecutor(),
    ]
    
    for executor in executors:
        for action_type in executor.supported_actions:
            registry[action_type] = executor
    
    return registry
