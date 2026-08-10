"""
FastAPI Backend — WebSocket bridge between browser and robot TCP controller.

Serves the frontend static files and provides:
- WebSocket endpoint (/ws) for real-time browser ↔ robot communication
- REST endpoints for configuration and status
"""

import asyncio
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from tcp_client import RobotTCPClient
from command_protocol import COMMAND_DESCRIPTIONS

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("server")

# ─── Paths ──────────────────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

# ─── Global State ───────────────────────────────────────────────────────────
tcp_client: Optional[RobotTCPClient] = None
connected_websockets: set[WebSocket] = set()
log_history: list[dict] = []
MAX_LOG_HISTORY = 500


def add_log(level: str, message: str, source: str = "server"):
    """Add a log entry and broadcast to connected WebSocket clients."""
    import time

    entry = {
        "timestamp": time.time(),
        "level": level,
        "message": message,
        "source": source,
    }
    log_history.append(entry)
    if len(log_history) > MAX_LOG_HISTORY:
        log_history.pop(0)

    # Schedule broadcast (non-blocking)
    asyncio.ensure_future(broadcast({"type": "log", "data": entry}))


async def broadcast(message: dict):
    """Send a message to all connected WebSocket clients."""
    dead = set()
    for ws in connected_websockets:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connected_websockets.difference_update(dead)


async def on_robot_status_update(status: dict):
    """Callback when robot sends a status update."""
    await broadcast({"type": "status_update", "data": status.get("data", status)})


# ─── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    global tcp_client

    tcp_client = RobotTCPClient(
        host="127.0.0.1",
        port=9999,
        on_status_update=on_robot_status_update,
    )

    add_log("INFO", "Server started")
    add_log("INFO", f"Robot TCP target: {tcp_client.host}:{tcp_client.port}")

    # Try connecting to the robot on startup
    connected = await tcp_client.connect()
    if connected:
        add_log("INFO", "Connected to robot TCP server")
    else:
        add_log("WARN", "Could not connect to robot — will retry on demand")

    yield

    # Shutdown
    if tcp_client:
        await tcp_client.disconnect()
    add_log("INFO", "Server stopped")


# ─── FastAPI App ────────────────────────────────────────────────────────────
app = FastAPI(title="MO Cobot Control", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST Endpoints ────────────────────────────────────────────────────────
@app.get("/api/status")
async def get_status():
    """Get current robot connection status."""
    if tcp_client:
        result = await tcp_client.send_command("GET_STATUS")
        return JSONResponse(content={
            "tcp_config": tcp_client.config,
            "robot": result,
        })
    return JSONResponse(content={"error": "TCP client not initialized"}, status_code=500)


@app.get("/api/config")
async def get_config():
    """Get current TCP configuration."""
    if tcp_client:
        return JSONResponse(content=tcp_client.config)
    return JSONResponse(content={"error": "TCP client not initialized"}, status_code=500)


@app.post("/api/config")
async def update_config(config: dict):
    """Update TCP configuration and reconnect."""
    if not tcp_client:
        return JSONResponse(content={"error": "TCP client not initialized"}, status_code=500)

    host = config.get("host", tcp_client.host)
    port = config.get("port", tcp_client.port)

    await tcp_client.disconnect()
    tcp_client.update_config(host, port)

    connected = await tcp_client.connect()

    add_log("INFO", f"TCP config updated: {host}:{port} — {'connected' if connected else 'failed'}")

    return JSONResponse(content={
        "host": host,
        "port": port,
        "connected": connected,
    })


@app.get("/api/logs")
async def get_logs():
    """Get log history."""
    return JSONResponse(content={"logs": log_history})


@app.get("/api/commands")
async def get_commands():
    """Get available command descriptions."""
    return JSONResponse(content=COMMAND_DESCRIPTIONS)


# ─── WebSocket Endpoint ────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Main WebSocket endpoint bridging browser ↔ robot TCP.

    Browser sends JSON: {"action": "INITIALIZE", "params": {...}}
    Server forwards to robot via TCP and relays the response.
    """
    await ws.accept()
    connected_websockets.add(ws)
    add_log("INFO", "Browser WebSocket connected")

    # Send initial status
    try:
        if tcp_client and tcp_client.connected:
            status = await tcp_client.send_command("GET_STATUS")
            await ws.send_json({"type": "status_update", "data": status.get("data", status)})
            await ws.send_json({"type": "connection", "data": {"tcp_connected": True}})
        else:
            await ws.send_json({"type": "connection", "data": {"tcp_connected": False}})

        # Send log history
        await ws.send_json({"type": "log_history", "data": log_history[-100:]})

    except Exception as e:
        logger.error(f"Error sending initial state: {e}")

    try:
        while True:
            raw = await ws.receive_text()

            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "data": {"message": "Invalid JSON"}})
                continue

            action = message.get("action", "")
            params = message.get("params", {})
            request_id = message.get("id", None)

            add_log("INFO", f"Command: {action} {params}", source="browser")

            # Special handling for connection management
            if action == "CONNECT":
                host = params.get("host", tcp_client.host if tcp_client else "127.0.0.1")
                port = params.get("port", tcp_client.port if tcp_client else 9999)

                if tcp_client:
                    await tcp_client.disconnect()
                    tcp_client.update_config(host, port)
                    connected = await tcp_client.connect()

                    response = {
                        "type": "command_response",
                        "action": action,
                        "id": request_id,
                        "data": {"connected": connected, "host": host, "port": port},
                    }
                    await ws.send_json(response)
                    await broadcast({"type": "connection", "data": {"tcp_connected": connected}})
                    add_log(
                        "INFO" if connected else "WARN",
                        f"TCP {'connected' if connected else 'failed'}: {host}:{port}",
                    )
                continue

            if action == "DISCONNECT":
                if tcp_client:
                    await tcp_client.disconnect()
                    await broadcast({"type": "connection", "data": {"tcp_connected": False}})
                    add_log("INFO", "TCP disconnected by user")
                continue

            # Forward command to robot
            if tcp_client:
                result = await tcp_client.send_command(action, **params)

                response = {
                    "type": "command_response",
                    "action": action,
                    "id": request_id,
                    "data": result,
                }
                await ws.send_json(response)

                # Log result
                status = result.get("status", "unknown")
                msg = result.get("message", "")
                add_log(
                    "INFO" if status == "ok" else "ERROR",
                    f"Response [{action}]: {msg}",
                    source="robot",
                )
            else:
                await ws.send_json({
                    "type": "error",
                    "action": action,
                    "id": request_id,
                    "data": {"message": "TCP client not available"},
                })

    except WebSocketDisconnect:
        add_log("INFO", "Browser WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        add_log("ERROR", f"WebSocket error: {e}")
    finally:
        connected_websockets.discard(ws)


# ─── Static Files (serve frontend) ─────────────────────────────────────────
@app.get("/")
async def serve_index():
    """Serve the main HTML page."""
    return FileResponse(FRONTEND_DIR / "index.html")


# Mount static files AFTER API routes
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
