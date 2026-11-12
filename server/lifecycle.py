"""Private sidecar shutdown and owner lifetime tracking; never terminate a health PID."""
import os
import secrets
import threading

import psutil
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request

import config


def install_shutdown(app: FastAPI) -> None:
    @app.post("/api/lifecycle/shutdown", include_in_schema=False)
    async def shutdown(request: Request, tasks: BackgroundTasks):
        token = request.headers.get("x-slate-lifecycle-token", "")
        if (config.OWNER != "tauri" or not config.LIFECYCLE_TOKEN
                or not secrets.compare_digest(token, config.LIFECYCLE_TOKEN)):
            raise HTTPException(status_code=403, detail="Not this server's owner")
        callback = getattr(app.state, "request_shutdown", None)
        if callback is None:
            raise HTTPException(status_code=503, detail="Shutdown unavailable")
        tasks.add_task(callback)
        return {"status": "stopping"}


def watch_parent() -> None:
    """Also clean up the PyInstaller child if its editor crashes or is force closed.

    psutil captures process creation time, so PID reuse cannot adopt another owner.
    Only this process exits; no process discovered over HTTP is ever signalled.
    """
    if config.OWNER != "tauri" or config.PARENT_PID is None:
        return
    try:
        parent = psutil.Process(config.PARENT_PID)
        parent.create_time()
    except psutil.NoSuchProcess:
        raise RuntimeError("The owning Slate editor has already exited") from None

    def wait():
        parent.wait()
        os._exit(0)

    threading.Thread(target=wait, name="slate-owner-watch", daemon=True).start()
