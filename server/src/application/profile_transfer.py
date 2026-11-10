"""Versioned JSON representation of a portable Slate profile."""
import json
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from src.core.models import ActionType, Button, Profile
from src.core.models.button import GRID_SIZE


PROFILE_FORMAT = "slate-profile"
PROFILE_VERSION = 1
MAX_PROFILE_BYTES = 1024 * 1024

PAYLOAD_FIELDS = {
    ActionType.OPEN_URL: "url",
    ActionType.APP_LAUNCH: "path",
    ActionType.OPEN_FOLDER: "path",
    ActionType.HOTKEY: "hotkey",
}


class PortableModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class PortableProfile(PortableModel):
    name: Annotated[str, Field(pattern=r"\S")]


class PortableButton(PortableModel):
    label: str
    icon: str = ""
    actionType: str
    actionPayload: dict | None = None
    background: str | None = None
    iconColor: str | None = None
    gridPosition: Annotated[int, Field(ge=0, lt=GRID_SIZE)]

    @model_validator(mode="after")
    def validate_action(self):
        try:
            action_type = ActionType(self.actionType)
        except ValueError:
            raise ValueError("Unsupported action type") from None
        field = PAYLOAD_FIELDS.get(action_type)
        if field:
            value = (self.actionPayload or {}).get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{action_type.value} requires a nonempty {field!r} string")
        return self

    def to_button(self) -> Button:
        return Button.from_dict({"id": str(uuid4()), **self.model_dump()})


class ProfileTransfer(PortableModel):
    format: Literal["slate-profile"]
    version: Literal[1]
    profile: PortableProfile
    buttons: Annotated[list[PortableButton], Field(max_length=GRID_SIZE)]

    @model_validator(mode="after")
    def validate_positions(self):
        positions = set()
        for button in self.buttons:
            if button.gridPosition in positions:
                raise ValueError(f"Multiple buttons occupy grid position {button.gridPosition}")
            positions.add(button.gridPosition)
        return self


def _encode(data: dict) -> bytes:
    contents = json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    return (contents + "\n").encode("utf-8")


def decode_profile(raw: bytes | bytearray) -> ProfileTransfer:
    try:
        data = json.loads(raw.decode("utf-8-sig"))
        # Reject non-JSON numbers and invalid Unicode, including within action payloads.
        _encode(data)
    except (ValueError, RecursionError) as error:
        raise ValueError("Invalid JSON. Choose a UTF-8 Slate profile JSON file.") from error

    if not isinstance(data, dict) or data.get("format") != PROFILE_FORMAT:
        raise ValueError("This file is not a Slate profile.")
    if type(data.get("version")) is not int or data["version"] != PROFILE_VERSION:
        raise ValueError("Unsupported Slate profile version. This editor supports version 1.")

    try:
        return ProfileTransfer.model_validate(data)
    except ValidationError as error:
        issue = error.errors(include_input=False)[0]
        field = ".".join(map(str, issue["loc"]))
        detail = issue["msg"].removeprefix("Value error, ")
        raise ValueError(f"Invalid profile{f' ({field})' if field else ''}. {detail}") from error


def encode_profile(profile: Profile, buttons: list[Button]) -> bytes:
    portable_buttons = []
    for button in buttons:
        data = button.to_dict()
        del data["id"]
        portable_buttons.append(data)
    return _encode({
        "format": PROFILE_FORMAT,
        "version": PROFILE_VERSION,
        "profile": {"name": profile.name},
        "buttons": portable_buttons,
    })
