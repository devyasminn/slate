"""HTTP routes for health check and configuration."""
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from typing import Annotated, Optional
import uuid
import socket
import logging
import sqlite3
import config

from src.application.profile_transfer import MAX_PROFILE_BYTES, ProfileTransfer, decode_profile, encode_profile
from src.core.interfaces import ButtonRepository, ProfileRepository
from src.core.interfaces.button_repository import ButtonConflictError
from src.infrastructure.auth import AuthService
from src.core.models import Button, Profile, ActionType
from src.core.models.button import GRID_SIZE
from src.presentation.websocket import WebSocketHandler


logger = logging.getLogger(__name__)

GridPosition = Annotated[int, Field(strict=True, ge=0, lt=GRID_SIZE)]


class ButtonDTO(BaseModel):
    """Data transfer object for button creation/update."""
    id: str
    label: str
    icon: Optional[str] = ""
    actionType: str
    actionPayload: Optional[dict] = None
    background: Optional[str] = None
    iconColor: Optional[str] = None
    gridPosition: Optional[GridPosition] = None

    def to_button(self, button_id: str) -> Button:
        return Button(
            id=button_id,
            label=self.label,
            icon=self.icon or "",
            action_type=ActionType(self.actionType),
            action_payload=self.actionPayload,
            background=self.background,
            icon_color=self.iconColor,
            grid_position=self.gridPosition,
        )


class MoveButtonRequest(BaseModel):
    """Move a button if the source and destination still match the editor's view."""
    fromPosition: GridPosition
    gridPosition: GridPosition
    targetButtonId: Optional[str]


class ProfileDTO(BaseModel):
    """Data transfer object for profile creation/update."""
    name: str


async def _read_profile_transfer(request: Request) -> ProfileTransfer:
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > MAX_PROFILE_BYTES:
            raise HTTPException(status_code=413, detail="Slate profile files must be 1 MiB or smaller.")
        raw.extend(chunk)
    try:
        return decode_profile(raw)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


def _resolve_profile_id(
    profile_id: Optional[str],
    profile_repository: ProfileRepository,
    allow_empty: bool = False
) -> Optional[str]:
    """Resolve profile_id to a valid ID, using default if not provided.
    
    Args:
        profile_id: The provided profile ID (may be None)
        profile_repository: Repository to fetch default profile
        allow_empty: If True, returns None when no profile exists instead of raising
    
    Returns:
        A valid profile_id string
        
    Raises:
        HTTPException 404 if no profile found and allow_empty is False
    """
    if profile_id:
        return profile_id
    
    default_profile = profile_repository.get_default_profile()
    if not default_profile:
        if allow_empty:
            return None
        raise HTTPException(status_code=404, detail="No profile found")
    return default_profile.id


def create_http_router(
    button_repository: ButtonRepository,
    profile_repository: ProfileRepository,
    ws_handler: WebSocketHandler,
    auth_service: AuthService,
) -> APIRouter:
    router = APIRouter()
    
    @router.get("/health")
    async def health_check():
        import os
        return {
            "status": "ok",
            "app": "slate-server",
            "owner": config.OWNER,
            "env": config.ENV,
            "instanceId": config.INSTANCE_ID,
            "qaSession": config.QA_SESSION,
            "pid": os.getpid()
        }
    
    @router.get("/api/buttons")
    async def get_buttons(profile_id: Optional[str] = Query(None, alias="profileId")):
        resolved_id = _resolve_profile_id(profile_id, profile_repository, allow_empty=True)
        if not resolved_id:
            return {"buttons": []}
        
        buttons = button_repository.get_all(resolved_id)
        return {"buttons": [b.to_dict() for b in buttons]}
    
    @router.post("/api/buttons")
    async def create_button(dto: ButtonDTO, profile_id: Optional[str] = Query(None, alias="profileId")):
        resolved_id = _resolve_profile_id(profile_id, profile_repository)
        
        try:
            button = button_repository.create(dto.to_button(dto.id), resolved_id)
        except ButtonConflictError as e:
            raise HTTPException(status_code=409, detail=str(e))
        except LookupError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        await ws_handler.broadcast_buttons_update(resolved_id)
        return {"status": "created", "button": button.to_dict()}
    
    @router.put("/api/buttons/{button_id}/position")
    async def move_button(
        button_id: str, request: MoveButtonRequest,
        profile_id: Optional[str] = Query(None, alias="profileId"),
    ):
        resolved_id = _resolve_profile_id(profile_id, profile_repository)

        try:
            moved = button_repository.move(
                button_id, resolved_id, request.fromPosition, request.gridPosition, request.targetButtonId,
            )
        except ButtonConflictError as e:
            raise HTTPException(status_code=409, detail=str(e))
        except LookupError as e:
            raise HTTPException(status_code=404, detail=str(e))

        if moved:
            await ws_handler.broadcast_buttons_update(resolved_id)
        return {"buttons": [b.to_dict() for b in button_repository.get_all(resolved_id)]}
    
    @router.get("/api/buttons/{button_id}")
    async def get_button(button_id: str, profile_id: Optional[str] = Query(None, alias="profileId")):
        resolved_id = _resolve_profile_id(profile_id, profile_repository)
        
        button = button_repository.get_by_id(button_id, resolved_id)
        if not button:
            raise HTTPException(status_code=404, detail="Button not found")
        return button.to_dict()
    
    @router.put("/api/buttons/{button_id}")
    async def update_button(button_id: str, dto: ButtonDTO, profile_id: Optional[str] = Query(None, alias="profileId")):
        resolved_id = _resolve_profile_id(profile_id, profile_repository)
        
        try:
            button = button_repository.update(dto.to_button(button_id), resolved_id)
        except LookupError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        await ws_handler.broadcast_buttons_update(resolved_id)
        return {"status": "updated", "button": button.to_dict()}
    
    @router.delete("/api/buttons/{button_id}")
    async def delete_button(button_id: str, profile_id: Optional[str] = Query(None, alias="profileId")):
        resolved_id = _resolve_profile_id(profile_id, profile_repository)
        
        deleted = button_repository.delete(button_id, resolved_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Button not found")
        await ws_handler.broadcast_buttons_update(resolved_id)
        return {"status": "deleted"}
    
    @router.get("/api/profiles")
    async def get_profiles():
        profiles = profile_repository.get_all()
        return {"profiles": [p.to_dict() for p in profiles]}

    @router.get("/api/profiles/{profile_id}/export")
    async def export_profile(profile_id: str):
        try:
            snapshot = profile_repository.get_with_buttons(profile_id)
            if snapshot is None:
                raise HTTPException(status_code=404, detail="Profile not found")
            data = encode_profile(*snapshot)
        except (sqlite3.Error, ValueError, RecursionError) as error:
            logger.exception("Failed to export profile")
            raise HTTPException(status_code=500, detail="Failed to export the saved profile.") from error
        if len(data) > MAX_PROFILE_BYTES:
            raise HTTPException(status_code=413, detail="The saved profile exceeds the 1 MiB export limit.")
        return Response(data, media_type="application/json")

    @router.post("/api/profiles/import/preview")
    async def preview_profile_import(request: Request):
        transfer = await _read_profile_transfer(request)
        return {"name": transfer.profile.name, "buttonCount": len(transfer.buttons)}

    @router.post("/api/profiles/import")
    async def import_profile(request: Request):
        transfer = await _read_profile_transfer(request)
        profile = Profile(id=str(uuid.uuid4()), name=transfer.profile.name)
        buttons = [button.to_button() for button in transfer.buttons]
        try:
            profiles = profile_repository.import_profile(profile, buttons)
        except sqlite3.Error as error:
            logger.exception("Failed to import profile")
            raise HTTPException(status_code=500, detail="Failed to save the imported profile.") from error
        await ws_handler.broadcast_profiles_update(profiles)
        await ws_handler.broadcast_profile_switch(profile.id)
        return {"profile": profile.to_dict(), "profiles": [item.to_dict() for item in profiles]}
    
    @router.get("/api/profiles/{profile_id}")
    async def get_profile(profile_id: str):
        profile = profile_repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return profile.to_dict()
    
    @router.get("/api/profiles/{profile_id}/buttons")
    async def get_profile_buttons(profile_id: str):
        profile = profile_repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        buttons = button_repository.get_all(profile_id)
        return {"buttons": [b.to_dict() for b in buttons]}
    
    @router.post("/api/profiles")
    async def create_profile(dto: ProfileDTO, activate: bool = False):
        profile_id = str(uuid.uuid4())
        profile = Profile(id=profile_id, name=dto.name)
        profile = profile_repository.create(profile)
        await ws_handler.broadcast_profiles_update()
        if activate:
            await ws_handler.broadcast_profile_switch(profile.id)
        return {"status": "created", "profile": profile.to_dict()}
    
    @router.put("/api/profiles/{profile_id}")
    async def update_profile(profile_id: str, dto: ProfileDTO):
        existing = profile_repository.get_by_id(profile_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        existing.name = dto.name
        profile = profile_repository.update(existing)
        await ws_handler.broadcast_profiles_update()
        return {"status": "updated", "profile": profile.to_dict()}
    
    @router.delete("/api/profiles/{profile_id}")
    async def delete_profile(profile_id: str):
        deleted = profile_repository.delete(profile_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Profile not found")
        await ws_handler.broadcast_profiles_update()
        return {"status": "deleted"}
    
    @router.post("/api/profiles/{profile_id}/switch")
    async def switch_profile(profile_id: str):
        """Switch active profile and notify all clients."""
        profile = profile_repository.get_by_id(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        await ws_handler.broadcast_profile_switch(profile_id)
        return {"status": "switched", "profileId": profile_id}
    
    # === Auth routes ===
    
    @router.get("/api/auth/qr-token")
    async def get_qr_token():
        """Issue a new temporary QR token for authentication."""
        qr_token = auth_service.issue_qr_token()
        return {"qrToken": qr_token, "ttlSeconds": auth_service.DEFAULT_QR_TTL_SECONDS}
    
    @router.post("/api/auth/exchange")
    async def exchange_qr_token(qr_token: str = Query(..., alias="qrToken")):
        """Exchange a QR token for a session token."""
        session_token = auth_service.exchange_qr_token(qr_token)
        if not session_token:
            raise HTTPException(
                status_code=401,
                detail="Invalid, expired, or already used QR token"
            )
        return {"sessionToken": session_token}
    
    @router.get("/api/server-info")
    async def get_server_info():
        """Return server connection information."""
        try:
            if config.ENV.lower() == "qa":
                return {"ip": "127.0.0.1", "port": config.PORT, "clientPort": config.PORT}
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
        except Exception:
            ip = "127.0.0.1"
        
        return {
            "ip": ip,
            "port": config.PORT,
            "clientPort": config.PORT if config.CLIENT_DIST_DIR.exists() else config.DEV_CLIENT_PORT
        }

    return router

