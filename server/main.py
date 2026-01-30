
"""
Slate Server - Entry Point
"""
import logging
import socket
import os
import sys
import asyncio
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import segno

import config
from src.application.use_cases import ExecuteActionUseCase
from src.infrastructure.executors import create_executor_registry
from src.infrastructure.persistence import (
    SQLiteButtonRepository,
    SQLiteProfileRepository,
    init_database,
)
from src.infrastructure.auth import AuthService
from src.infrastructure.monitors import SystemMonitor
from src.presentation.websocket import WebSocketHandler
from src.presentation.http import create_http_router


def is_frozen() -> bool:
    """Check if running as a frozen executable (PyInstaller)."""
    return getattr(sys, 'frozen', False)


# Safe logging setup - avoid dictConfig issues in frozen mode
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def get_local_ip() -> str:
    """Get the local IP address of the machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def build_app(
    database_file: str | Path = config.DATABASE_FILE,
    tokens_file: Path = config.TOKENS_FILE,
    testing: bool = False,
) -> FastAPI:
    """
    Factory function to create the FastAPI app with injected dependencies.
    
    Args:
        database_file: Path to SQLite database
        tokens_file: Path to tokens JSON file  
        testing: If True, disables background tasks and simplifies CORS
    
    Returns:
        Configured FastAPI application instance
    """
    db_path = Path(database_file)
    init_database(db_path)
    
    button_repository = SQLiteButtonRepository(str(db_path))
    profile_repository = SQLiteProfileRepository(str(db_path))
    executor_registry = create_executor_registry()
    execute_action_use_case = ExecuteActionUseCase(executor_registry)
    auth_service = AuthService(tokens_file)
    
    # Skip monitor in testing mode
    system_monitor = None if testing else SystemMonitor()
    
    ws_handler = WebSocketHandler(
        execute_action_use_case,
        button_repository,
        profile_repository,
        auth_service,
        system_monitor,
    )
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not testing:
            await ws_handler.start_heartbeat()
        yield
        if not testing:
            await ws_handler.stop_heartbeat()
    
    app = FastAPI(
        title="Slate Server",
        description="Remote control server for PC",
        version="0.1.0",
        lifespan=lifespan,
    )
    
    if testing:
        # Simplified CORS for tests - avoid network calls
        allowed_origins = ["*"]
    else:
        local_ip = get_local_ip()
        allowed_origins = [
            f"http://localhost:{config.PORT}",
            f"http://127.0.0.1:{config.PORT}",
            f"http://{local_ip}:{config.PORT}",
            f"http://localhost:{config.DEV_CLIENT_PORT}",
            f"http://127.0.0.1:{config.DEV_CLIENT_PORT}",
            f"http://{local_ip}:{config.DEV_CLIENT_PORT}",
            f"http://localhost:{config.DEV_EDITOR_PORT}",
            "http://tauri.localhost",
            "https://tauri.localhost",
            "tauri://localhost",
        ]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    http_router = create_http_router(button_repository, profile_repository, ws_handler, auth_service)
    app.include_router(http_router)
    
    if not testing and config.CLIENT_DIST_DIR.exists():
        assets_dir = config.CLIENT_DIST_DIR / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        
        @app.get("/favicon.svg")
        @app.get("/logo.svg")
        async def serve_root_static(request: Request):
            filename = request.url.path.lstrip("/")
            file_path = config.CLIENT_DIST_DIR / filename
            if file_path.exists():
                return FileResponse(file_path)
            return FileResponse(config.CLIENT_DIST_DIR / "index.html")
        
        # SPA fallback: serve index.html for all non-API routes
        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Don't intercept API or health routes
            if full_path.startswith("api/") or full_path == "health" or full_path.startswith("ws"):
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Not Found")
            
            file_path = config.CLIENT_DIST_DIR / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            
            return FileResponse(config.CLIENT_DIST_DIR / "index.html")
    
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await ws_handler.connect(websocket)
        try:
            while True:
                data = await websocket.receive_text()
                await ws_handler.handle_message(websocket, data)
        except WebSocketDisconnect:
            ws_handler.disconnect(websocket)
    
    app.state.auth_service = auth_service
    
    return app


# Production app (created at module load for uvicorn)
app = build_app()


# === Production-only utilities ===

def display_qr_code(url: str) -> None:
    try:
        qr = segno.make(url)
        qr.terminal(compact=True)
    except Exception:
        pass


def clear_terminal() -> None:
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')


def display_server_info(client_url: str, qr_token: str, ttl: int) -> None:
    """Display server info and QR code with authentication token."""
    clear_terminal()
    
    authenticated_url = f"{client_url}?qrToken={qr_token}"
    
    print()
    print("  SLATE SERVER")
    print("  " + "-" * 30)
    print(f"  Connect: {authenticated_url}")
    print()
    
    display_qr_code(authenticated_url)
    
    print("  " + "-" * 30)
    print(f"  QR refreshes every {ttl}s")
    print()


def qr_refresh_loop(client_url: str, auth_service: AuthService, stop_event: threading.Event) -> None:
    """Background thread that refreshes QR code periodically."""
    while not stop_event.is_set():
        qr_token = auth_service.issue_qr_token()
        display_server_info(client_url, qr_token, auth_service.DEFAULT_QR_TTL_SECONDS)
        stop_event.wait(timeout=auth_service.DEFAULT_QR_TTL_SECONDS)


if __name__ == "__main__":
    local_ip = get_local_ip()
    # Use the production flag from config which handles frozen/sidecar environment
    is_production = config.IS_PRODUCTION
    
    if is_production:
        # In production/sidecar, we use the server port (8000) for the QR code
        client_url = f"http://{local_ip}:{config.PORT}"
    else:
        # In development, we use the Vite dev port for the QR code
        client_url = f"http://{local_ip}:{config.DEV_CLIENT_PORT}"
    
    # In frozen mode (sidecar), skip QR display and use simpler logging
    if not is_frozen():
        stop_event = threading.Event()
        qr_thread = threading.Thread(
            target=qr_refresh_loop,
            args=(client_url, app.state.auth_service, stop_event),
            daemon=True
        )
        qr_thread.start()
    
    try:
        # In frozen mode, disable uvicorn's logging config to avoid dictConfig crash
        if is_frozen():
            # Use simple config that doesn't trigger logging.config.dictConfig
            uvicorn.run(
                app,
                host=config.HOST,
                port=config.PORT,
                log_config=None,  # Disable uvicorn's logging config
                access_log=False
            )
        else:
            uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")
    finally:
        if not is_frozen():
            stop_event.set()

