"""
Command Protocol — Abstracted command builder for robot TCP communication.

All TCP commands flow through this module. When you learn the actual robot protocol,
modify build_command() and parse_response() — no other file needs to change.
"""

import json
from typing import Any

# ─── Command Constants ──────────────────────────────────────────────────────
# These define the action names used internally. The actual bytes sent to the
# robot are constructed in build_command().

INITIALIZE = "INITIALIZE"
START = "START"
STOW = "STOW"
ABORT = "ABORT"
HOME = "HOME"
STOP = "STOP"

# Movement
MOVE_X = "MOVE_X"
MOVE_Y = "MOVE_Y"
MOVE_Z = "MOVE_Z"

# Calibration
SET_CALIBRATION = "SET_CALIBRATION"
GO_CALIBRATION = "GO_CALIBRATION"
READ_LASER = "READ_LASER"
UPDATE_LASER_TCP = "UPDATE_LASER_TCP"

# Status
GET_STATUS = "GET_STATUS"

# Task-specific
SET_TASK = "SET_TASK"
GET_PROGRESS = "GET_PROGRESS"


def build_command(action: str, **params) -> bytes:
    """
    Build the byte payload to send to the robot over TCP.

    This is the SINGLE POINT OF CHANGE for the outbound protocol.
    Currently sends JSON-encoded commands. Replace this with your
    robot's actual wire format (binary, ASCII, proprietary, etc.).

    Args:
        action: One of the command constants above.
        **params: Additional parameters for the command.

    Returns:
        bytes: The encoded payload ready to send over the socket.

    Examples:
        build_command(INITIALIZE)
        build_command(MOVE_X, value=10.5, step_size=1.0)
        build_command(SET_CALIBRATION, position=1, x=100.0, y=200.0)
    """
    command = {
        "action": action,
        "params": params,
    }
    # JSON + newline delimiter. Replace with your protocol's encoding.
    return (json.dumps(command) + "\n").encode("utf-8")


def parse_response(data: bytes) -> dict[str, Any]:
    """
    Parse the robot's TCP response into a Python dict.

    This is the SINGLE POINT OF CHANGE for the inbound protocol.
    Currently expects JSON-encoded responses. Replace this with
    your robot's actual response format.

    Args:
        data: Raw bytes received from the robot socket.

    Returns:
        dict: Parsed response with at least a 'status' key.
    """
    try:
        text = data.decode("utf-8").strip()
        if not text:
            return {"status": "empty", "message": "No data received"}
        return json.loads(text)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        return {
            "status": "error",
            "message": f"Failed to parse response: {e}",
            "raw": data.hex(),
        }


# ─── Command Descriptions (for UI/logging) ─────────────────────────────────

COMMAND_DESCRIPTIONS = {
    INITIALIZE: "Initialize robot system",
    START: "Start current task program",
    STOW: "Stow robot to safe position",
    ABORT: "Emergency abort current operation",
    HOME: "Home robot to origin position",
    STOP: "Stop current movement",
    MOVE_X: "Move robot along X axis",
    MOVE_Y: "Move robot along Y axis",
    MOVE_Z: "Move robot along Z axis",
    SET_CALIBRATION: "Set calibration point",
    GO_CALIBRATION: "Go to calibration point",
    READ_LASER: "Read laser measurement",
    UPDATE_LASER_TCP: "Update laser TCP offset",
    GET_STATUS: "Get robot status",
    SET_TASK: "Set active task type",
    GET_PROGRESS: "Get task progress",
}
