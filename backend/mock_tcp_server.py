"""
Mock TCP Server — Simulates a robot controller for development and testing.

Run standalone:  python3 mock_tcp_server.py [--port 9999]

Responds to all commands defined in command_protocol.py with realistic
mock data including state transitions and timed process progression.
"""

import asyncio
import json
import argparse
import logging
import time
import random

logging.basicConfig(level=logging.INFO, format="%(asctime)s [MOCK] %(message)s")
logger = logging.getLogger("mock_tcp_server")


class MockRobotState:
    """Simulates the internal state of a robot controller."""

    def __init__(self):
        self.connected = True
        self.robot_mode = "POWER_OFF"
        self.current_command = "NO COMMAND"
        self.program_running = False
        self.safety_status = "NORMAL"
        self.initialized = False

        # Position
        self.x = 0.0
        self.y = 0.0
        self.z = 0.0

        # Current task
        self.active_task = "bolt"  # bolt, clean, gel

        # Calibration points
        self.cal_points = {
            1: {"x": 0.0, "y": 0.0, "z": 0.0, "set": False},
            2: {"x": 0.0, "y": 0.0, "z": 0.0, "set": False},
        }

        # Laser
        self.laser_value = 0.0
        self.laser_tcp = {"x": 0.0, "y": 0.0, "z": 0.0}

        # Process progress
        self.process_steps = []
        self.process_progress = 0.0
        self.process_running = False
        self._process_task = None

        # Bolt task state
        self.bolt_positions = {}
        for i in range(1, 41):
            self.bolt_positions[i] = {
                "status": "pending",  # pending, in_progress, complete
                "torque": 0,
            }

        # Gel task state
        self.outer_gels = 0
        self.inner_gels = 0
        self.backers = 0
        self.total_gels = 9

    def get_status(self) -> dict:
        """Return current robot status."""
        status = {
            "status": "ok",
            "type": "status_update",
            "data": {
                "connected": self.connected,
                "robot_mode": self.robot_mode,
                "current_command": self.current_command,
                "program_running": self.program_running,
                "safety_status": self.safety_status,
                "initialized": self.initialized,
                "position": {"x": round(self.x, 2), "y": round(self.y, 2), "z": round(self.z, 2)},
                "active_task": self.active_task,
                "process_progress": round(self.process_progress, 1),
                "process_steps": self.process_steps,
            },
        }

        # Add task-specific data
        if self.active_task == "bolt":
            status["data"]["bolt_positions"] = self.bolt_positions
        elif self.active_task == "gel":
            status["data"]["gel_status"] = {
                "outer_gels": self.outer_gels,
                "inner_gels": self.inner_gels,
                "backers": self.backers,
                "total": self.total_gels,
            }

        return status


class MockTCPServer:
    """Async TCP server that simulates a robot controller."""

    def __init__(self, host: str = "0.0.0.0", port: int = 9999):
        self.host = host
        self.port = port
        self.state = MockRobotState()
        self._process_task: asyncio.Task | None = None

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Handle a single client connection."""
        addr = writer.get_extra_info("peername")
        logger.info(f"Client connected: {addr}")

        try:
            while True:
                data = await reader.readline()
                if not data:
                    break

                try:
                    command = json.loads(data.decode("utf-8").strip())
                except (json.JSONDecodeError, UnicodeDecodeError):
                    response = {"status": "error", "message": "Invalid command format"}
                    writer.write((json.dumps(response) + "\n").encode())
                    await writer.drain()
                    continue

                action = command.get("action", "")
                params = command.get("params", {})
                logger.info(f"← {action} {params}")

                response = await self.process_command(action, params)
                logger.info(f"→ {response.get('status', 'unknown')}")

                writer.write((json.dumps(response) + "\n").encode())
                await writer.drain()

        except (ConnectionResetError, BrokenPipeError):
            logger.info(f"Client disconnected: {addr}")
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def process_command(self, action: str, params: dict) -> dict:
        """Process a command and return a response."""
        # Simulate slight processing delay
        await asyncio.sleep(0.05)

        handlers = {
            "INITIALIZE": self._handle_initialize,
            "START": self._handle_start,
            "STOW": self._handle_stow,
            "ABORT": self._handle_abort,
            "HOME": self._handle_home,
            "STOP": self._handle_stop,
            "MOVE_X": self._handle_move_x,
            "MOVE_Y": self._handle_move_y,
            "MOVE_Z": self._handle_move_z,
            "SET_CALIBRATION": self._handle_set_calibration,
            "GO_CALIBRATION": self._handle_go_calibration,
            "READ_LASER": self._handle_read_laser,
            "UPDATE_LASER_TCP": self._handle_update_laser_tcp,
            "GET_STATUS": self._handle_get_status,
            "SET_TASK": self._handle_set_task,
            "GET_PROGRESS": self._handle_get_progress,
        }

        handler = handlers.get(action)
        if handler:
            return await handler(params)

        return {"status": "error", "message": f"Unknown command: {action}"}

    async def _handle_initialize(self, params: dict) -> dict:
        self.state.current_command = "INITIALIZING"
        self.state.robot_mode = "INITIALIZING"

        # Simulate initialization (async)
        asyncio.create_task(self._simulate_init())

        return {"status": "ok", "message": "Initialization started"}

    async def _simulate_init(self):
        await asyncio.sleep(2.0)
        self.state.robot_mode = "RUNNING"
        self.state.initialized = True
        self.state.current_command = "NO COMMAND"
        logger.info("Robot initialized")

    async def _handle_start(self, params: dict) -> dict:
        if not self.state.initialized:
            return {"status": "error", "message": "Robot not initialized"}

        self.state.current_command = "RUNNING PROGRAM"
        self.state.program_running = True
        self.state.process_progress = 0.0

        # Start process simulation
        if self._process_task and not self._process_task.done():
            self._process_task.cancel()
        self._process_task = asyncio.create_task(self._simulate_process())

        return {"status": "ok", "message": "Program started"}

    async def _simulate_process(self):
        """Simulate a multi-step process."""
        task = self.state.active_task

        if task == "bolt":
            steps = [
                "Moving to bolt position",
                "Aligning tool",
                "Engaging fastener",
                "Applying torque",
                "Verifying torque",
                "Retracting tool",
                "Moving to next position",
                "Cycle completed",
            ]
        elif task == "gel":
            steps = [
                "Pickup End Effector with Gel from Nest",
                "Hover End Effector on ESC",
                "Preparation to place Gel",
                "Place Gel on surface",
                "Press and hold",
                "Placement Validation",
                "Return End Effector",
                "Cycle Completed",
            ]
        else:  # clean
            steps = [
                "Moving to chamber entry",
                "Deploying cleaning tool",
                "Cleaning zone 1",
                "Cleaning zone 2",
                "Cleaning zone 3",
                "Retracting cleaning tool",
                "Inspection scan",
                "Cycle completed",
            ]

        self.state.process_steps = []
        total = len(steps)

        for i, step in enumerate(steps):
            self.state.process_steps.append({"name": step, "status": "in_progress"})
            self.state.process_progress = ((i) / total) * 100

            await asyncio.sleep(random.uniform(1.5, 3.0))

            self.state.process_steps[-1]["status"] = "complete"
            self.state.process_progress = ((i + 1) / total) * 100

            # Update task-specific counters
            if task == "gel" and step == "Placement Validation":
                if self.state.outer_gels < self.state.total_gels:
                    self.state.outer_gels += 1
                elif self.state.inner_gels < self.state.total_gels:
                    self.state.inner_gels += 1
                else:
                    self.state.backers += 1

            if task == "bolt" and step == "Verifying torque":
                # Mark a random bolt as complete
                for pos_id, pos in self.state.bolt_positions.items():
                    if pos["status"] == "pending":
                        pos["status"] = "complete"
                        pos["torque"] = random.choice([20, 40, 60])
                        break

        self.state.program_running = False
        self.state.current_command = "NO COMMAND"
        logger.info(f"Process complete for task: {task}")

    async def _handle_stow(self, params: dict) -> dict:
        self.state.current_command = "STOWING"

        async def _do_stow():
            await asyncio.sleep(2.0)
            self.state.x = 0.0
            self.state.y = 0.0
            self.state.z = 0.0
            self.state.current_command = "NO COMMAND"
            self.state.robot_mode = "IDLE"
            logger.info("Robot stowed")

        asyncio.create_task(_do_stow())
        return {"status": "ok", "message": "Stowing robot"}

    async def _handle_abort(self, params: dict) -> dict:
        if self._process_task and not self._process_task.done():
            self._process_task.cancel()

        self.state.program_running = False
        self.state.current_command = "ABORTED"
        self.state.process_progress = 0.0
        return {"status": "ok", "message": "Operation aborted"}

    async def _handle_home(self, params: dict) -> dict:
        self.state.current_command = "HOMING"

        async def _do_home():
            await asyncio.sleep(1.5)
            self.state.x = 0.0
            self.state.y = 0.0
            self.state.z = 0.0
            self.state.current_command = "NO COMMAND"
            logger.info("Robot homed")

        asyncio.create_task(_do_home())
        return {"status": "ok", "message": "Homing robot"}

    async def _handle_stop(self, params: dict) -> dict:
        self.state.current_command = "STOPPED"
        return {"status": "ok", "message": "Movement stopped"}

    async def _handle_move_x(self, params: dict) -> dict:
        step = params.get("value", 1.0)
        self.state.x += step
        self.state.current_command = f"MOVE X {step:+.1f}"

        async def _clear():
            await asyncio.sleep(0.5)
            self.state.current_command = "NO COMMAND"

        asyncio.create_task(_clear())
        return {
            "status": "ok",
            "message": f"Moved X by {step:+.1f}",
            "position": {"x": round(self.state.x, 2), "y": round(self.state.y, 2)},
        }

    async def _handle_move_y(self, params: dict) -> dict:
        step = params.get("value", 1.0)
        self.state.y += step
        self.state.current_command = f"MOVE Y {step:+.1f}"

        async def _clear():
            await asyncio.sleep(0.5)
            self.state.current_command = "NO COMMAND"

        asyncio.create_task(_clear())
        return {
            "status": "ok",
            "message": f"Moved Y by {step:+.1f}",
            "position": {"x": round(self.state.x, 2), "y": round(self.state.y, 2)},
        }

    async def _handle_move_z(self, params: dict) -> dict:
        step = params.get("value", 1.0)
        self.state.z += step
        self.state.current_command = f"MOVE Z {step:+.1f}"

        async def _clear():
            await asyncio.sleep(0.5)
            self.state.current_command = "NO COMMAND"

        asyncio.create_task(_clear())
        return {
            "status": "ok",
            "message": f"Moved Z by {step:+.1f}",
            "position": {"x": round(self.state.x, 2), "y": round(self.state.y, 2), "z": round(self.state.z, 2)},
        }

    async def _handle_set_calibration(self, params: dict) -> dict:
        pos = params.get("position", 1)
        self.state.cal_points[pos] = {
            "x": self.state.x,
            "y": self.state.y,
            "z": self.state.z,
            "set": True,
        }
        return {
            "status": "ok",
            "message": f"Calibration point {pos} set",
            "point": self.state.cal_points[pos],
        }

    async def _handle_go_calibration(self, params: dict) -> dict:
        pos = params.get("position", 1)
        point = self.state.cal_points.get(pos)
        if not point or not point.get("set"):
            return {"status": "error", "message": f"Calibration point {pos} not set"}

        self.state.x = point["x"]
        self.state.y = point["y"]
        self.state.z = point["z"]
        return {"status": "ok", "message": f"Moved to calibration point {pos}"}

    async def _handle_read_laser(self, params: dict) -> dict:
        # Simulate a laser reading
        self.state.laser_value = round(random.uniform(0.1, 50.0), 3)
        return {
            "status": "ok",
            "message": "Laser measurement taken",
            "value": self.state.laser_value,
            "unit": "mm",
        }

    async def _handle_update_laser_tcp(self, params: dict) -> dict:
        self.state.laser_tcp = {
            "x": params.get("x", 0.0),
            "y": params.get("y", 0.0),
            "z": params.get("z", 0.0),
        }
        return {"status": "ok", "message": "Laser TCP updated", "tcp": self.state.laser_tcp}

    async def _handle_get_status(self, params: dict) -> dict:
        return self.state.get_status()

    async def _handle_set_task(self, params: dict) -> dict:
        task = params.get("task", "bolt")
        if task not in ("bolt", "clean", "gel"):
            return {"status": "error", "message": f"Unknown task: {task}"}

        self.state.active_task = task
        self.state.process_steps = []
        self.state.process_progress = 0.0
        return {"status": "ok", "message": f"Task set to {task}"}

    async def _handle_get_progress(self, params: dict) -> dict:
        return {
            "status": "ok",
            "progress": self.state.process_progress,
            "steps": self.state.process_steps,
            "task": self.state.active_task,
        }

    async def start(self):
        """Start the mock TCP server."""
        server = await asyncio.start_server(
            self.handle_client,
            self.host,
            self.port,
        )

        addr = server.sockets[0].getsockname()
        logger.info(f"Mock robot TCP server listening on {addr[0]}:{addr[1]}")
        logger.info("Waiting for connections...")

        async with server:
            await server.serve_forever()


def main():
    parser = argparse.ArgumentParser(description="Mock Robot TCP Server")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=9999, help="Bind port (default: 9999)")
    args = parser.parse_args()

    server = MockTCPServer(host=args.host, port=args.port)
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        logger.info("Server stopped")


if __name__ == "__main__":
    main()
