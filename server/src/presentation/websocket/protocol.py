"""
WebSocket Protocol Definition.

Message types and directions:
    Client -> Server:  HELLO, BUTTON_PRESSED, GET_BUTTONS, PONG
    Server -> Client:  WELCOME, ACTION_RESULT, BUTTONS_LIST, ERROR, PING
"""
from enum import Enum
from typing import Any


PROTOCOL_VERSION = "1.0"


class MessageType(str, Enum):
    # Handshake
    HELLO = "HELLO"
    WELCOME = "WELCOME"
    
    # Authentication
    AUTH_REQUIRED = "AUTH_REQUIRED"
    AUTH_RESULT = "AUTH_RESULT"
    
    # Application
    BUTTON_PRESSED = "BUTTON_PRESSED"
    GET_BUTTONS = "GET_BUTTONS"
    ACTION_RESULT = "ACTION_RESULT"
    BUTTONS_LIST = "BUTTONS_LIST"
    ERROR = "ERROR"
    
    # Profiles
    GET_PROFILES = "GET_PROFILES"
    PROFILES_LIST = "PROFILES_LIST"
    SWITCH_PROFILE = "SWITCH_PROFILE"
    PROFILE_SWITCHED = "PROFILE_SWITCHED"
    
    # Heartbeat
    PING = "PING"
    PONG = "PONG"
    
    # System monitoring
    SYSTEM_STATS = "SYSTEM_STATS"


def create_message(msg_type: MessageType, payload: Any = None) -> dict:
    return {"type": msg_type.value, "payload": payload or {}}
