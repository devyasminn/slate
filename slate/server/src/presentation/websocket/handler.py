"""WebSocket connection handler with heartbeat and authentication."""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field

from fastapi import WebSocket

import config
from src.application.use_cases import ExecuteActionUseCase
from src.infrastructure.persistence import SQLiteButtonRepository, SQLiteProfileRepository
from src.infrastructure.auth import AuthService
from src.infrastructure.monitors import SystemMonitor
from .protocol import MessageType, create_message, PROTOCOL_VERSION


logger = logging.getLogger(__name__)


@dataclass
class ConnectionInfo:
    websocket: WebSocket
    client_version: str | None = None
    is_authenticated: bool = False
    active_profile_id: str | None = None
    connected_at: float = field(default_factory=time.time)
    last_pong: float = field(default_factory=time.time)


class WebSocketHandler:
    """Handles WebSocket connections with heartbeat and authentication."""
    
    def __init__(
        self,
        execute_action_use_case: ExecuteActionUseCase,
        button_repository: SQLiteButtonRepository,
        profile_repository: SQLiteProfileRepository,
        auth_service: AuthService,
        system_monitor: SystemMonitor | None = None,
    ):
        self._execute_action = execute_action_use_case
        self._button_repository = button_repository
        self._profile_repository = profile_repository
        self._auth_service = auth_service
        self._system_monitor = system_monitor
        self._connections: dict[WebSocket, ConnectionInfo] = {}
        self._heartbeat_task: asyncio.Task | None = None
        self._stats_task: asyncio.Task | None = None
    
    async def start_heartbeat(self) -> None:
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            logger.info("Heartbeat task started")
        if self._stats_task is None:
            self._stats_task = asyncio.create_task(self._stats_broadcast_loop())
            logger.info("Stats broadcast task started")
    
    async def stop_heartbeat(self) -> None:
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None
            logger.info("Heartbeat task stopped")
        
        if self._stats_task:
            self._stats_task.cancel()
            try:
                await self._stats_task
            except asyncio.CancelledError:
                pass
            self._stats_task = None
            logger.info("Stats broadcast task stopped")
    
    async def _heartbeat_loop(self) -> None:
        while True:
            await asyncio.sleep(config.PING_INTERVAL_SECONDS)
            await self._send_ping_to_all()
            await self._cleanup_stale_connections()
    
    async def _stats_broadcast_loop(self) -> None:
        """Broadcast system stats to all authenticated clients."""
        if self._system_monitor is None:
            return
        while True:
            await asyncio.sleep(1)  # Update every second
            stats = self._system_monitor.get_stats()
            await self._broadcast_stats(stats)
    
    async def _broadcast_stats(self, stats) -> None:
        """Send system stats to all authenticated clients."""
        if not self._connections:
            return
        
        message = create_message(MessageType.SYSTEM_STATS, {
            "cpu": stats.cpu_percent,
            "ram": stats.ram_percent,
            "gpu": stats.gpu_percent,
        })
        
        for ws, info in list(self._connections.items()):
            if info.is_authenticated:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass  # Connection cleanup handled by heartbeat
    
    async def _send_ping_to_all(self) -> None:
        if not self._connections:
            return
        
        message = create_message(MessageType.PING)
        
        for ws in list(self._connections.keys()):
            try:
                await ws.send_json(message)
            except Exception:
                await self._close_connection(ws, "Send failed")
    
    async def _cleanup_stale_connections(self) -> None:
        now = time.time()
        
        for ws, info in list(self._connections.items()):
            if now - info.last_pong > config.PONG_TIMEOUT_SECONDS:
                await self._close_connection(ws, "Heartbeat timeout")
    
    async def _close_connection(self, websocket: WebSocket, reason: str) -> None:
        if websocket not in self._connections:
            return
        
        del self._connections[websocket]
        logger.info(f"Connection closed: {reason}. Active: {len(self._connections)}")
        
        try:
            await websocket.close(code=1000, reason=reason)
        except Exception:
            pass
    
    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[websocket] = ConnectionInfo(websocket=websocket)
        logger.info(f"Client connected. Active: {len(self._connections)}")
    
    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            del self._connections[websocket]
            logger.info(f"Client disconnected. Active: {len(self._connections)}")
    
    def _is_authenticated(self, websocket: WebSocket) -> bool:
        info = self._connections.get(websocket)
        return info is not None and info.is_authenticated
    
    async def handle_message(self, websocket: WebSocket, data: str) -> None:
        try:
            message = json.loads(data)
            msg_type = message.get("type")
            payload = message.get("payload", {})
            
            match msg_type:
                case MessageType.HELLO.value:
                    await self._handle_hello(websocket, payload)
                case MessageType.BUTTON_PRESSED.value:
                    await self._handle_button_pressed(websocket, payload)
                case MessageType.GET_BUTTONS.value:
                    await self._handle_get_buttons(websocket)
                case MessageType.GET_PROFILES.value:
                    await self._handle_get_profiles(websocket)
                case MessageType.SWITCH_PROFILE.value:
                    await self._handle_switch_profile(websocket, payload)
                case MessageType.PONG.value:
                    self._handle_pong(websocket)
                case _:
                    logger.warning(f"Unknown message type: {msg_type}")
                    
        except json.JSONDecodeError:
            await self._send_error(websocket, "Invalid JSON")
        except Exception as e:
            logger.exception("Error handling message")
            await self._send_error(websocket, str(e))
    
    async def _handle_hello(self, websocket: WebSocket, payload: dict) -> None:
        client_version = payload.get("version", "unknown")
        token = payload.get("token")
        
        if websocket in self._connections:
            self._connections[websocket].client_version = client_version
        
        if client_version != PROTOCOL_VERSION:
            logger.warning(f"Client version mismatch: {client_version} (server: {PROTOCOL_VERSION})")
        
        if self._auth_service.validate_token(token):
            self._connections[websocket].is_authenticated = True
            logger.info("Client authenticated via token.")
            
            if not self._connections[websocket].active_profile_id:
                default_profile = self._profile_repository.get_default_profile()
                if default_profile:
                    self._connections[websocket].active_profile_id = default_profile.id
            
            await websocket.send_json(create_message(
                MessageType.WELCOME,
                {"version": PROTOCOL_VERSION}
            ))
            await self._send_profiles_list(websocket)
            await self._send_buttons_list(websocket)
        else:
            # Token invalid or missing - require authentication via QR code
            await websocket.send_json(create_message(MessageType.AUTH_REQUIRED))
    
    def _handle_pong(self, websocket: WebSocket) -> None:
        if websocket in self._connections:
            self._connections[websocket].last_pong = time.time()
    
    async def _handle_button_pressed(self, websocket: WebSocket, payload: dict) -> None:
        if not self._is_authenticated(websocket):
            await self._send_error(websocket, "Not authenticated")
            return
        
        button_id = payload.get("buttonId")
        profile_id = self._connections[websocket].active_profile_id
        
        if not button_id:
            await self._send_error(websocket, "Missing buttonId")
            return
        
        if not profile_id:
            await self._send_error(websocket, "No active profile")
            return
        
        button = self._button_repository.get_by_id(button_id, profile_id)
        
        if not button:
            await self._send_error(websocket, f"Button not found: {button_id}")
            return
        
        result = self._execute_action.execute(button)
        await websocket.send_json(create_message(MessageType.ACTION_RESULT, result))
    
    async def _handle_get_buttons(self, websocket: WebSocket) -> None:
        if not self._is_authenticated(websocket):
            await self._send_error(websocket, "Not authenticated")
            return
        
        await self._send_buttons_list(websocket)
    
    async def _send_buttons_list(self, websocket: WebSocket) -> None:
        profile_id = self._connections[websocket].active_profile_id
        if not profile_id:
            await websocket.send_json(create_message(MessageType.BUTTONS_LIST, {"buttons": []}))
            return
        
        buttons = self._button_repository.get_all(profile_id)
        payload = {"buttons": [b.to_dict() for b in buttons]}
        await websocket.send_json(create_message(MessageType.BUTTONS_LIST, payload))
    
    async def _handle_get_profiles(self, websocket: WebSocket) -> None:
        if not self._is_authenticated(websocket):
            await self._send_error(websocket, "Not authenticated")
            return
        
        await self._send_profiles_list(websocket)
    
    async def _send_profiles_list(self, websocket: WebSocket) -> None:
        profiles = self._profile_repository.get_all()
        payload = {"profiles": [p.to_dict() for p in profiles]}
        await websocket.send_json(create_message(MessageType.PROFILES_LIST, payload))
    
    async def _handle_switch_profile(self, websocket: WebSocket, payload: dict) -> None:
        if not self._is_authenticated(websocket):
            await self._send_error(websocket, "Not authenticated")
            return
        
        profile_id = payload.get("profileId")
        if not profile_id:
            await self._send_error(websocket, "Missing profileId")
            return
        
        profile = self._profile_repository.get_by_id(profile_id)
        if not profile:
            await self._send_error(websocket, f"Profile not found: {profile_id}")
            return
        
        self._connections[websocket].active_profile_id = profile_id
        
        await self._send_buttons_list(websocket)
        
        await websocket.send_json(create_message(
            MessageType.PROFILE_SWITCHED,
            {"profileId": profile_id}
        ))
    
    async def broadcast_buttons_update(self, profile_id: str | None = None) -> None:
        """Broadcast updated buttons list to all authenticated clients."""
        if not self._connections:
            return
        
        # If profile_id provided, broadcast only to clients with that profile;
        # otherwise broadcast to all clients with their respective active profiles
        for ws, info in list(self._connections.items()):
            if not info.is_authenticated:
                continue
            
            target_profile_id = profile_id or info.active_profile_id
            if not target_profile_id:
                continue
            
            try:
                buttons = self._button_repository.get_all(target_profile_id)
                payload = {"buttons": [b.to_dict() for b in buttons]}
                message = create_message(MessageType.BUTTONS_LIST, payload)
                await ws.send_json(message)
            except Exception:
                pass  # Connection cleanup handled by heartbeat
    
    async def broadcast_profiles_update(self) -> None:
        """Broadcast updated profiles list to all authenticated clients."""
        if not self._connections:
            return
        
        profiles = self._profile_repository.get_all()
        payload = {"profiles": [p.to_dict() for p in profiles]}
        message = create_message(MessageType.PROFILES_LIST, payload)
        
        for ws, info in list(self._connections.items()):
            if info.is_authenticated:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass  # Connection cleanup handled by heartbeat
    
    async def broadcast_profile_switch(self, profile_id: str) -> None:
        """Broadcast profile switch to all authenticated clients."""
        if not self._connections:
            return
        
        profile = self._profile_repository.get_by_id(profile_id)
        if not profile:
            return
        
        for ws, info in list(self._connections.items()):
            if info.is_authenticated:
                info.active_profile_id = profile_id
                
                try:
                    await ws.send_json(create_message(
                        MessageType.PROFILE_SWITCHED,
                        {"profileId": profile_id}
                    ))
                    
                    buttons = self._button_repository.get_all(profile_id)
                    payload = {"buttons": [b.to_dict() for b in buttons]}
                    await ws.send_json(create_message(MessageType.BUTTONS_LIST, payload))
                except Exception:
                    pass  # Connection cleanup handled by heartbeat
    
    async def _send_error(self, websocket: WebSocket, message: str) -> None:
        await websocket.send_json(create_message(MessageType.ERROR, {"message": message}))
    
    @property
    def connection_count(self) -> int:
        return len(self._connections)

