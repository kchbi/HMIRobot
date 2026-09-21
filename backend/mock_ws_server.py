#!/usr/bin/env python3
"""
Standalone Mock WebSocket Server for MO Cobot GUI.

A 100% Python async WebSocket server that simulates robot operations directly.
No FastAPI, uvicorn, TCP client, or secondary servers required.

Run standalone:
    python3 mock_ws_server.py --port 8080

Features:
- Configurable per-command response delays (COMMAND_CONFIG)
- Full robot state machine & simulated bolting sequence
- Direct WebSocket communication with React frontend
- Periodic and event-driven status broadcasts (update_state)
- Real-time logging broadcasts (log & log_history) for GUI Logs Tab
"""

import asyncio
import json
import logging
import argparse
import random
import copy
import time
from typing import Dict, Any, Set, Optional, List

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    print("Error: 'websockets' library is required. Install it using:")
    print("    pip install websockets")
    exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [MOCK-WS] %(levelname)s: %(message)s",
)
logger = logging.getLogger("mock_ws_server")

# ═════════════════════════════════════════════════════════════════════════════
# 1. COMMAND CONFIGURATION (Response Templates & Customizable Response Delays)
# ═════════════════════════════════════════════════════════════════════════════
# Customize delay (in seconds) and response payload for every command here.
# You can set delay to 0.5, 2.0, 5.0, 10.0, etc.

COMMAND_CONFIG: Dict[str, Dict[str, Any]] = {
    "turn_robot_off": {
        "delay": 1.0,
        "response": {"type": "command_received", "data": 6},
    },
    "turn_robot_on": {
        "delay": 1.0,
        "response": {"type": "command_received", "data": 7},
    },
    "release_brakes": {
        "delay": 1.5,
        "response": {"type": "command_received", "data": 0},
    },
    "initialize": {
        "delay": 2.0,
        "response": {"type": "command_received", "data": 1},
    },
    "start": {
        "delay": 0.5,
        "response": {"type": "command_received", "data": 2},
    },
    "pause": {
        "delay": 0.1,
        "response": {"type": "command_received", "data": 3},
    },
    "abort": {
        "delay": 0.1,
        "response": {"type": "command_received", "data": 4},
    },
    "stow": {
        "delay": 2.5,
        "response": {"type": "command_received", "data": 5},
    },
    "load_app": {
        "delay": 0.5,
        "response": {
            "type": "load_app",
            "data": {
                "app_name": "TopPlateBolt",
                "app_data": "Application 'TopPlateBolt' loaded",
            },
        },
    },
    "bolt_config": {
        "delay": 0.1,
        "response": {
            "type": "command_received",
            "data": {"status": "ok", "message": "Bolt config set"},
        },
    },
    "shutdown": {
        "delay": 1.0,
        "response": {"type": "command_received", "data": ""},
    },
    "get_status": {
        "delay": 0.05,
        "response": {"type": "command_received", "data": ""},
    },
    "cda_popup": {
        "delay": 0.05,
        "response": {"type": "cda_popup", "data": True},
    },
    "caliberation": {
        "delay": 3.0,
        "response": {
            "type": "command_received",
            "data": {"status": "ok", "message": "Calibration complete"},
        },
    },
    "get_bolt_torque": {
        "delay": 0.05,
        "response": {"type": "get_bolt_torque", "data": []},
    },
    "get_bolt_status": {
        "delay": 0.05,
        "response": {"type": "get_bolt_status", "data": []},
    },
}

DEFAULT_FALLBACK_DELAY = 0.1


def _caliberation_mode(data: Any) -> str:
    """Extracts "start" / "validate" from a caliberation command payload."""
    if isinstance(data, str):
        return data.strip().lower()
    if isinstance(data, dict):
        return str(data.get("value", data.get("mode", ""))).strip().lower()
    return ""


# ═════════════════════════════════════════════════════════════════════════════
# 2. MOCK ROBOT STATE & SIMULATION ENGINE
# ═════════════════════════════════════════════════════════════════════════════
class MockRobotState:
    """Manages the robot's state and active process simulations."""

    def __init__(self):
        self.connected = True
        self.robot_mode = "RUNNING"  # Real robot controller mode: RUNNING, INITIALIZING, POWER_OFF, IDLE
        self.current_command = "NO COMMAND"
        self.program_running = False
        self.safety_status = "NORMAL"
        self.application_state = None
        self.robot_model = None
        self.robot_firmware_version = None
        self.polyscope_version = None
        self.serial_number = None
        self.remote_control = False
        self.cda_status = True
        self.cda_popup = True
        self.initialized = False

        # Cartesian Position (X, Y, Z in mm)
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0

        # Active task: 'bolt', 'clean', 'gel'
        self.active_task = "bolt"

        # Calibration
        self.cal_points = {
            1: {"x": 10.0, "y": 20.0, "z": 0.0, "set": False},
            2: {"x": 50.0, "y": 60.0, "z": 0.0, "set": False},
        }
        self.laser_value = 45.2
        self.laser_tcp = {"x": 0.0, "y": 0.0, "z": 0.0}

        # Calibration routine
        self.calibration_running = False
        self.calibration_valid = False

        # Task Progress
        self.process_progress = 0.0
        self.process_steps = []
        self.active_bolt: Optional[int] = None
        self._process_task: Optional[asyncio.Task] = None

        # 24/40 Bolts initialization & real robot bolt_torque color array
        self.bolt_positions = {}
        self.bolt_torque = ["white"] * 24
        self._reset_bolts()

    def color_match(self, passes: int) -> str:
        """Matches passes count to real robot color name."""
        match passes:
            case 5:
                return "lawngreen"
            case 4:
                return "lawngreen"
            case 3:
                return "yellow"
            case 2:
                return "orange"
            case 1:
                return "red"
            case 0:
                return "indigo"
            case _:
                return "white"

    def _reset_bolts(self):
        self.bolt_torque = ["white"] * 24
        for i in range(1, 41):
            self.bolt_positions[i] = {
                "status": "pending",  # pending, in_progress, complete
                "torque": 0,
                "color": "white",
            }

    def get_status_payload(self) -> Dict[str, Any]:
        """Constructs the standard update_state message payload matching the real robot backend."""
        data = {
            # Real backend exact camelCase schema
            "robotMode": self.robot_mode,
            "programIsRunning": self.program_running,
            "safetyStatus": self.safety_status,
            "applicationState": self.application_state,
            "currentCommand": self.current_command,
            "robotModel": self.robot_model,
            "robotFirmwareVersion": self.robot_firmware_version,
            "polyscopeVersion": self.polyscope_version,
            "serialNumber": self.serial_number,
            "remoteControl": self.remote_control,
            "cdaStatus": self.cda_status,
            # Backward compatibility / simulation fields
            "connected": self.connected,
            "robot_mode": self.robot_mode,
            "current_command": self.current_command,
            "program_running": self.program_running,
            "safety_status": self.safety_status,
            "initialized": self.initialized,
            "position": {
                "x": round(self.x, 2),
                "y": round(self.y, 2),
                "z": round(self.z, 2),
            },
            "active_task": self.active_task,
            "process_progress": round(self.process_progress, 1),
            "process_steps": self.process_steps,
        }

        if self.active_task == "bolt":
            data["bolt_positions"] = self.bolt_positions
            data["active_bolt"] = self.active_bolt

        return {"type": "update_state", "data": data}

    def stop_process(self):
        if self._process_task and not self._process_task.done():
            self._process_task.cancel()
        self.program_running = False
        self.current_command = "NO COMMAND"
        self.active_bolt = None

    async def run_bolting_simulation(self, broadcast_fn, log_fn):
        """Simulates automated bolting process across 40 bolts."""
        try:
            self.program_running = True
            self.current_command = "BOLTING_SEQUENCE"
            total_bolts = 24  # Matches the 24 visual markers on the plate layout
            await log_fn("INFO", f"Bolting process sequence started across {total_bolts} bolts", "robot")

            for bolt_idx in range(1, total_bolts + 1):
                self.active_bolt = bolt_idx
                self.bolt_positions[bolt_idx]["status"] = "in_progress"
                self.process_progress = (bolt_idx - 0.5) / total_bolts * 100.0
                await broadcast_fn(self.get_status_payload())

                # Simulate tool movement & bolting torque pass (1.5s per bolt)
                await asyncio.sleep(1.5)

                passes = random.choice([4, 5, 3, 2])
                color = self.color_match(passes)
                torque_val = random.choice([20, 40, 60])
                self.bolt_positions[bolt_idx]["status"] = "complete"
                self.bolt_positions[bolt_idx]["torque"] = torque_val
                self.bolt_positions[bolt_idx]["color"] = color
                self.bolt_torque[bolt_idx - 1] = color

                self.process_progress = bolt_idx / total_bolts * 100.0
                await broadcast_fn(self.get_status_payload())
                # Broadcast real get_bolt_torque message with color array
                await broadcast_fn({"type": "get_bolt_torque", "data": self.bolt_torque})
                await log_fn("INFO", f"Torqued bolt #{bolt_idx} (color: {color}, passes: {passes})", "robot")

            self.program_running = False
            self.current_command = "SEQUENCE_COMPLETE"
            self.active_bolt = None
            await broadcast_fn(self.get_status_payload())
            await log_fn("INFO", "Bolting sequence completed successfully (100%)", "robot")
            logger.info("Bolting sequence completed successfully.")
        except asyncio.CancelledError:
            await log_fn("WARN", "Bolting sequence was cancelled/aborted", "robot")
            logger.info("Bolting sequence was cancelled/aborted.")


def generate_mock_camera_frame(frame_num: int) -> List[int]:
    """Generates a synthetic PNG test frame with crosshair and telemetry overlay."""
    try:
        from PIL import Image, ImageDraw
        import io
        img = Image.new("RGB", (640, 480), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)
        # Background Grid
        for x in range(0, 640, 40):
            draw.line([(x, 0), (x, 480)], fill=(30, 41, 59), width=1)
        for y in range(0, 480, 40):
            draw.line([(0, y), (640, y)], fill=(30, 41, 59), width=1)
        # Center Reticle
        cx, cy = 320, 240
        draw.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], outline=(110, 226, 204), width=2)
        draw.line([(cx - 70, cy), (cx + 70, cy)], fill=(110, 226, 204), width=2)
        draw.line([(cx, cy - 70), (cx, cy + 70)], fill=(110, 226, 204), width=2)
        # Simulated bolt target
        draw.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(34, 197, 94))
        draw.text((20, 20), f"SIMULATED COBOT VISION - FRAME #{frame_num}", fill=(248, 250, 252))
        draw.text((20, 40), "RESOLUTION: 640x480 | STATUS: TARGET ACQUIRED", fill=(148, 163, 184))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return list(buf.getvalue())
    except Exception:
        return [137, 80, 78, 71, 13, 10, 26, 10]


# ═════════════════════════════════════════════════════════════════════════════
# 3. WEBSOCKET SERVER IMPLEMENTATION
# ═════════════════════════════════════════════════════════════════════════════
class MockWebSocketServer:
    """Standalone WebSocket Server serving robot state & response handling."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8080, delay_multiplier: float = 1.0, status_interval: float = 0.2, simulate_camera: bool = False):
        self.host = host
        self.port = port
        self.delay_multiplier = max(0.0, delay_multiplier)
        self.status_interval = status_interval
        self.simulate_camera = simulate_camera
        self.camera_frame_idx = 0
        self.robot = MockRobotState()
        self.connected_clients: Set[Any] = set()
        self.log_history: List[Dict[str, Any]] = []
        self.max_logs = 500

        # Seed initial log entry
        self._add_log_sync("INFO", "Mock Robot WebSocket Server started", "server")

    def _add_log_sync(self, level: str, message: str, source: str = "server") -> Dict[str, Any]:
        entry = {
            "timestamp": time.time(),
            "level": level,
            "message": message,
            "source": source,
        }
        self.log_history.append(entry)
        if len(self.log_history) > self.max_logs:
            self.log_history.pop(0)
        return entry

    async def add_log(self, level: str, message: str, source: str = "server"):
        """Adds a log entry and broadcasts it to all connected frontend clients."""
        entry = self._add_log_sync(level, message, source)
        await self.broadcast({"type": "log", "data": entry})

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcasts a JSON message to all connected clients."""
        if not self.connected_clients:
            return
        raw = json.dumps(message)
        dead = set()
        for ws in self.connected_clients:
            try:
                await ws.send(raw)
            except Exception:
                dead.add(ws)
        self.connected_clients.difference_update(dead)

    async def _periodic_status_loop(self):
        """Broadcasts status update every 200ms (5Hz) continuously to mirror the real robot backend."""
        while True:
            try:
                await asyncio.sleep(self.status_interval)
                if self.connected_clients:
                    await self.broadcast(self.robot.get_status_payload())
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic broadcast: {e}")

    async def _periodic_camera_loop(self):
        """Broadcasts simulated camera frame every 200ms (5Hz) to connected clients."""
        while True:
            try:
                await asyncio.sleep(0.2)
                if self.connected_clients:
                    self.camera_frame_idx += 1
                    frame_bytes = generate_mock_camera_frame(self.camera_frame_idx)
                    await self.broadcast({"type": "camera_frame", "data": frame_bytes})
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic camera broadcast: {e}")

    async def handle_client(self, websocket):
        """Handles individual WebSocket connection lifecycle."""
        self.connected_clients.add(websocket)
        client_addr = getattr(websocket, "remote_address", "client")
        logger.info(f"Client connected: {client_addr} (Total clients: {len(self.connected_clients)})")

        try:
            # 1. Send connection status, log history, cda_popup, and bolt_torque
            await websocket.send(json.dumps({"type": "connection", "data": {"tcp_connected": True}}))
            await websocket.send(json.dumps({"type": "log_history", "data": self.log_history[-100:]}))
            await websocket.send(json.dumps({"type": "cda_popup", "data": self.robot.cda_popup}))
            await websocket.send(json.dumps({"type": "get_bolt_torque", "data": self.robot.bolt_torque}))

            await self.add_log("INFO", f"Browser connected from {client_addr}", "server")

            # 2. Main incoming message loop
            async for raw in websocket:
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({"type": "error", "data": {"message": "Invalid JSON format"}}))
                    continue

                cmd_type = str(message.get("type", "")).strip().lower()
                data = message.get("data", {})

                # Fast-path relay for camera frames (e.g. from camera producer scripts or ROS bridge)
                if cmd_type == "camera_frame":
                    await self.broadcast(message)
                    continue

                logger.info(f"Received command: type='{cmd_type}', data={data}")

                # Log incoming command to the frontend Logs tab (skip high-frequency polling commands)
                if cmd_type not in ("get_bolt_torque", "get_bolt_status", "get_status"):
                    await self.add_log("INFO", f"Command: {cmd_type.upper()} {data if data else ''}", "browser")

                # Execute state updates and fetch response
                response_msg = await self.process_command(cmd_type, data)

                # Send reply back to the requesting client
                if response_msg:
                    await websocket.send(json.dumps(response_msg))
                    if cmd_type not in ("get_bolt_torque", "get_bolt_status", "get_status"):
                        raw_data = response_msg.get("data")
                        if isinstance(raw_data, dict):
                            resp_msg_text = raw_data.get("message", "OK")
                            resp_status = raw_data.get("status", "ok")
                        else:
                            resp_msg_text = f"Code {raw_data}"
                            resp_status = "ok"
                        await self.add_log(
                            "INFO" if resp_status == "ok" else "ERROR",
                            f"Response [{cmd_type.upper()}]: {resp_msg_text}",
                            "robot",
                        )

                # Broadcast updated state ONLY if program is currently running
                if self.robot.program_running:
                    await self.broadcast(self.robot.get_status_payload())

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client disconnected: {client_addr}")
        except Exception as e:
            logger.error(f"Client handler error: {e}")
        finally:
            self.connected_clients.discard(websocket)

    async def process_command(self, cmd_type: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Processes command, applies state transition, delays response, and returns response."""
        # 1. Look up config
        config = COMMAND_CONFIG.get(cmd_type, {
            "delay": DEFAULT_FALLBACK_DELAY,
            "response": {
                "type": "command_received",
                "data": {"status": "ok", "message": f"Executed {cmd_type}"},
            },
        })

        base_delay = config.get("delay", DEFAULT_FALLBACK_DELAY)
        effective_delay = base_delay * self.delay_multiplier

        # 2. Apply immediate state changes
        if cmd_type == "initialize":
            self.robot.robot_mode = "INITIALIZING"
            self.robot.current_command = "INITIALIZING"
            self.robot._reset_bolts()
            # Real backend does not send update_state on initialize; only sends command_received

        elif cmd_type == "load_app":
            app_name = data.get("app_name", "TopPlateBolt")
            task_map = {"TopPlateBolt": "bolt", "ChamberClean": "clean", "GelInstall": "gel"}
            self.robot.active_task = task_map.get(app_name, "bolt")
            self.robot.process_progress = 0.0
            self.robot._reset_bolts()
            logger.info(f"Loaded app: '{app_name}' (task='{self.robot.active_task}')")
            return {
                "type": "load_app",
                "data": {
                    "app_name": app_name,
                    "app_data": f"Application '{app_name}' loaded",
                },
            }

        elif cmd_type == "bolt_config":
            bolt_num = data.get("boltNum", 1)
            torque_num = data.get("torqueNum", 1)
            self.robot.active_bolt = bolt_num
            logger.info(f"Bolt config set: boltNum={bolt_num}, torqueNum={torque_num}")
            return {
                "type": "command_received",
                "data": {"status": "ok", "message": f"Bolt config set: bolt={bolt_num}, torque={torque_num}"},
            }

        elif cmd_type == "start":
            self.robot.robot_mode = "RUNNING"
            self.robot.program_running = True
            self.robot.current_command = "RUNNING"

        elif cmd_type in ("abort", "stop"):
            self.robot.stop_process()
            self.robot.current_command = "STOPPED"

        elif cmd_type == "connect":
            self.robot.connected = True
            await self.broadcast({"type": "connection", "data": {"tcp_connected": True}})
            return {
                "type": "command_received",
                "data": {"status": "ok", "connected": True, "message": "Connected to robot"},
            }

        elif cmd_type == "disconnect":
            self.robot.connected = False
            self.robot.initialized = False
            self.robot.robot_mode = "POWER_OFF"
            await self.broadcast({"type": "connection", "data": {"tcp_connected": False}})
            return {
                "type": "command_received",
                "data": {"status": "ok", "connected": False, "message": "Disconnected from robot"},
            }

        elif cmd_type == "stow":
            self.robot.stop_process()
            self.robot.current_command = "STOWED"
            self.robot.initialized = False
            self.robot.robot_mode = "POWER_OFF"
            self.robot.active_bolt = None
            self.robot.process_progress = 0.0
            self.robot._reset_bolts()
            self.robot.x = 0.0
            self.robot.y = 0.0
            self.robot.z = 0.0

        elif cmd_type == "cda_popup":
            if isinstance(data, dict) and "data" in data:
                self.robot.cda_popup = bool(data["data"])
            elif isinstance(data, bool):
                self.robot.cda_popup = data
            return {
                "type": "cda_popup",
                "data": self.robot.cda_popup,
            }

        elif cmd_type in ("get_bolt_torque", "get_bolt_status"):
            return {
                "type": cmd_type,
                "data": self.robot.bolt_torque,
            }

        elif cmd_type == "move_x":
            val = float(data.get("value", 1.0))
            self.robot.x += val

        elif cmd_type == "move_y":
            val = float(data.get("value", 1.0))
            self.robot.y += val

        elif cmd_type == "move_z":
            val = float(data.get("value", 1.0))
            self.robot.z += val

        elif cmd_type == "read_laser":
            self.robot.laser_value = round(random.uniform(40.0, 50.0), 2)

        elif cmd_type == "caliberation" and _caliberation_mode(data) == "start":
            self.robot.calibration_running = True
            self.robot.calibration_valid = False
            self.robot.current_command = "CALIBRATING"

        # 3. Simulate command execution delay
        if effective_delay > 0:
            logger.info(f"Waiting {effective_delay:.2f}s before sending '{cmd_type}' response...")
            await asyncio.sleep(effective_delay)

        # 4. Finalize state changes after delay
        if cmd_type == "initialize":
            self.robot.robot_mode = "RUNNING"
            self.robot.initialized = True
            self.robot.current_command = "READY"
            self.robot._reset_bolts()

        elif cmd_type == "caliberation" and _caliberation_mode(data) == "start":
            self.robot.calibration_running = False
            self.robot.calibration_valid = True
            self.robot.current_command = "NO COMMAND"

        elif cmd_type == "start":
            # Launch background simulation for the active task
            if self.robot.active_task == "bolt":
                self.robot.stop_process()
                self.robot._process_task = asyncio.create_task(
                    self.robot.run_bolting_simulation(self.broadcast, self.add_log)
                )

        # 5. Build response from config template
        response = copy.deepcopy(config.get("response"))

        # Inject dynamic data into response if applicable
        if response and isinstance(response.get("data"), dict):
            if cmd_type == "load_app":
                app_name = data.get("app_name", "TopPlateBolt")
                response["data"]["app_name"] = f"Application '{app_name}' loaded"
                response["data"]["app_data"] = "Task Done"
            elif cmd_type == "bolt_config":
                response["data"]["message"] = f"Bolt config set: bolt={data.get('boltNum')}, torque={data.get('torqueNum')}"
            elif cmd_type == "read_laser":
                response["data"]["value"] = self.robot.laser_value
                response["data"]["message"] = f"Laser reading: {self.robot.laser_value} mm"
            elif cmd_type == "caliberation":
                mode = _caliberation_mode(data)
                if mode == "validate":
                    valid = self.robot.calibration_valid
                    response["data"]["status"] = "ok" if valid else "error"
                    response["data"]["valid"] = valid
                    response["data"]["message"] = (
                        "Calibration validated" if valid else "No calibration to validate"
                    )
                elif mode == "start":
                    response["data"]["message"] = "Calibration routine complete"
                else:
                    response["data"]["status"] = "error"
                    response["data"]["message"] = f"Unknown caliberation mode: {mode!r}"

        return response

    async def run(self):
        """Starts WebSocket server and background status broadcast task."""
        logger.info(f"Starting Standalone Mock WebSocket Server on ws://{self.host}:{self.port} ...")
        logger.info(f"Delay multiplier: {self.delay_multiplier}x")
        logger.info(f"Broadcasting telemetry stream at {1.0 / self.status_interval:.1f}Hz ({int(self.status_interval * 1000)}ms interval)")
        logger.info("Configured command response times:")
        for cmd, cfg in COMMAND_CONFIG.items():
            logger.info(f"  • {cmd.ljust(18)}: {cfg.get('delay', DEFAULT_FALLBACK_DELAY) * self.delay_multiplier:.2f}s delay")

        # Start continuous 5Hz (200ms) broadcaster
        broadcast_task = asyncio.create_task(self._periodic_status_loop())
        if self.simulate_camera:
            logger.info("Starting simulated 5Hz camera frame broadcast loop...")
            camera_task = asyncio.create_task(self._periodic_camera_loop())

        async with serve(self.handle_client, self.host, self.port):
            logger.info(f"✓ Mock Server is active and listening on ws://{self.host}:{self.port}")
            print(f"\n[READY] Connect your React frontend to ws://localhost:{self.port}/ws\n")
            await asyncio.Future()  # run forever


# ═════════════════════════════════════════════════════════════════════════════
# 4. ENTRY POINT
# ═════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="Standalone Mock WebSocket Server for MO Cobot GUI")
    parser.add_argument("--host", default="0.0.0.0", help="Host address to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8080, help="Port to listen on (default: 8080)")
    parser.add_argument(
        "--delay-multiplier",
        type=float,
        default=1.0,
        help="Multiplier for command response delays (e.g. 2.0 to double, 0.0 for instant)",
    )
    parser.add_argument(
        "--status-interval",
        type=float,
        default=0.2,
        help="Interval in seconds for update_state broadcasts (default: 0.2 = 200ms)",
    )
    parser.add_argument(
        "--simulate-camera",
        action="store_true",
        help="Simulate 5Hz camera frames over WebSocket",
    )
    args = parser.parse_args()

    server = MockWebSocketServer(
        host=args.host,
        port=args.port,
        delay_multiplier=args.delay_multiplier,
        status_interval=args.status_interval,
        simulate_camera=args.simulate_camera,
    )

    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        logger.info("Server stopped by user.")


if __name__ == "__main__":
    main()
