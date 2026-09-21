# MO Cobot Command Protocols & Data Architecture

This document provides an exhaustive reference explaining **where the command protocols are stored**, **how they are structured**, and **how they are executed** across the frontend and backend.

---

## 1. System Architecture Overview

The system operates primarily on a **direct WebSocket wire protocol**:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             REACT HMI (Browser)                                  │
│                                                                                  │
│  [MainPanelPage]  ─┐                                                             │
│  [CalibrationPage] ─┴─► AppContext.sendCommand() ──► useWebSocket.js             │
│                                                              │                    │
│                                                              │ (JSON over WS)     │
│                                                              ▼                    │
└──────────────────────────────────────────────────────────────┼───────────────────┘
                                                               │ ws://<host>:8080/ws
┌──────────────────────────────────────────────────────────────┼───────────────────┐
│                                                              ▼                    │
│                        PYTHON WEBSOCKET SERVER (Backend)                         │
│                                                                                  │
│  mock_ws_server.py / Real Robot Controller                                       │
│  • Reads command sequentially via handle_client()                                │
│  • Matches against COMMAND_CONFIG                                                │
│  • Emits single response: {"type": "command_received", "data": "<code>"}         │
│  • Streams high-frequency telemetry {"type": "update_state"} while running       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Core Communication Principles
1. **Fire-and-Forget Dispatch:** Outbound commands are sent over the WebSocket immediately without complex client-side Promise queues or FIFO locks.
2. **Deterministic String Code Mapping:** Command acknowledgments return unique numeric string codes (e.g. `"1"` for `initialize`, `"2"` for `start`). The frontend matches these via `RESPONSE_CODE_MAP`, preventing race conditions.
3. **Continuous/Gated Telemetry Stream:** The backend streams live telemetry broadcasts (`update_state`) at 5 Hz (200 ms) and real-time color updates via `get_bolt_torque`.
4. **Object *or* Scalar Payloads:** `data` is usually an object (`{"app_name": "..."}`), but some commands carry a bare scalar instead (`"data": "start"`). Both `sendCommand` implementations pass a scalar straight through, and `main.py` normalizes a non-dict `data` to `{"value": data}` before forwarding it to the TCP layer.

### Standard 6-Step Command Flow
```text
1. CONNECT
   ws://<host>:<port>/ws
   │
   ▼
2. load_app
   {"type": "load_app", "data": {"app_name": "TopPlateBolt"}}
   │
   ▼  Wait for response: "type": == "load_app"
3. bolt_config   [Dispatched automatically after load_app response]
   {"type": "bolt_config", "data": {"boltNum": 24, "torqueNum": 5}}
   │
   ▼
4. initialize
   {"type": "initialize"}
   │
   ▼  Wait for response: "type": == "command_received" (code: 1)
5. start
   {"type": "start"}
   │
   ▼  Wait for response: "type": == "command_received" (code: 2)
6. MONITOR update_state & get_bolt_torque messages
```

---

## 2. File-by-File Code Storage Inventory

The command protocols and state management rules are stored across the following files:

### A. Frontend Protocol Files (`frontend-react/src/`)

| File Path | What is Stored Here |
| :--- | :--- |
| [`src/context/AppContext.jsx`](frontend-react/src/context/AppContext.jsx) | • **`RESPONSE_CODE_MAP`**: Lookup table matching string return codes (`"0"`–`"6"`) to command names.<br>• **`handleMessage`**: Central switch board handling `command_received`, `update_state`, `status_update`, `connection`, `log`.<br>• **`sendCommand`**: Outbound serializer creating `{"type": "...", "data": ...}`.<br>• **`logs` State**: In-memory ring buffer (up to 1,000 items) recording every transmitted and received frame. |
| [`src/hooks/useWebSocket.js`](frontend-react/src/hooks/useWebSocket.js) | • **WebSocket Transport Lifecycle**: `ws.onopen`, `ws.onmessage`, `ws.onclose`, `ws.onerror`.<br>• **Wire Dispatch**: Low-level `ws.send(JSON.stringify(msg))`.<br>• **Auto-Reconnect**: Exponential backoff reconnect logic (up to 10 retries). |
| [`src/components/boltPlateLayout.js`](frontend-react/src/components/boltPlateLayout.js) | • **`BOLT_OVERLAY_POSITIONS`**: Sub-pixel accurate X/Y coordinates for all 24 bolt holes on the plate artwork.<br>• **`TORQUE_COLORS`**: Color mapping (`20` lb-in ➔ Red, `40` lb-in ➔ Amber, `60` lb-in ➔ Green).<br>• **`TORQUE_LEGEND`**: Visual legend definitions. |
| [`src/components/BoltPlateVisual.jsx`](frontend-react/src/components/BoltPlateVisual.jsx) | • **Active Bolt Detection**: Reads `data.active_bolt` (or fallback `status: "in_progress"`).<br>• **`markerColor` Function**: Controls animated pulsing ring on active bolt and sets solid torque colors upon completion. |
| [`src/pages/MainPanelPage.jsx`](frontend-react/src/pages/MainPanelPage.jsx) | • **Button Action Bindings**: Links UI buttons to actions (`INITIALIZE`, `START`, `STOW`).<br>• **Interlock Logic**: Disables Start until `initialized === true`, locks controls during `program_running`. |
| [`src/pages/AdvancedPage.jsx`](frontend-react/src/pages/AdvancedPage.jsx) | • **Debug Console**: Dropdown command list (`TURN_ROBOT_ON`, `RELEASE_BRAKES`, `PAUSE`, `ABORT`, etc.).<br>• **Connect / Disconnect Buttons**: Direct manual control of robot socket. |
| [`src/pages/CalibratePage.jsx`](frontend-react/src/pages/CalibratePage.jsx) | • Calibration command triggers: `GO_CALIBRATION`, `SET_CALIBRATION`, `READ_LASER`, `UPDATE_LASER_TCP`. |
| [`src/pages/CalibrationPage.jsx`](frontend-react/src/pages/CalibrationPage.jsx) | • Standalone page reached from the Home screen (`/calibration`), outside any task.<br>• Calibration routine triggers: `{"type": "caliberation", "data": "start"}` and `{"type": "caliberation", "data": "validate"}`. |
| [`src/components/RobotMovePad.jsx`](frontend-react/src/components/RobotMovePad.jsx) | • Manual jogging: `MOVE_X`, `MOVE_Y` with step size slider (0.1 mm – 50.0 mm) and keyboard hotkeys. |

---

### B. Backend Protocol Files (`backend/`)

| File Path | What is Stored Here |
| :--- | :--- |
| [`backend/mock_ws_server.py`](backend/mock_ws_server.py) | • **`COMMAND_CONFIG`**: Master dictionary defining artificial delays and response templates for all commands.<br>• **`MockRobotState`**: State machine holding coordinates, bolt array, torque values, and task progress.<br>• **`process_command`**: Execution logic applying state transitions for `initialize`, `start`, `stow`, `connect`, etc.<br>• **`run_bolting_simulation`**: Async bolting loop driving bolts 1 through 24 and streaming `update_state`.<br>• **`log_history`**: Ring buffer storing the last 500 log events in server RAM. |
| [`backend/main.py`](backend/main.py) | • Alternative **FastAPI + Uvicorn** server acting as a bridge between WebSocket clients and TCP hardware controllers. |
| [`backend/tcp_client.py`](backend/tcp_client.py) | • Low-level socket manager connecting to physical robot controllers via TCP (`\n`-delimited framing). |
| [`backend/command_protocol.py`](backend/command_protocol.py) | • Pydantic models and validators for the legacy `{action, params, id}` framing. |
| [`backend/ur_*_protocol.json`](backend/) | • Low-level packet and register specifications for Universal Robots Client and Realtime interfaces. |

---

## 3. The Master Command Matrix

The following table defines the exact wire protocol negotiated between the HMI and the Backend:

| Command Name | Outbound JSON (`type` & `data`) | Triggered From | Expected Response | Response Code (`data`) | Frontend Action / State Transition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`initialize`** | `{"type": "initialize"}` | Main Panel / Advanced | `command_received` | `"1"` | Sets `initialized: true`, sets `robot_mode: "IDLE"`, turns dot green, **enables Start button**. |
| **`start`** | `{"type": "start"}` | Main Panel / Advanced | `command_received` | `"2"` | Sets `program_running: true`, disables Start/Initialize buttons, keeps Stow button enabled, begins telemetry stream. |
| **`pause`** | `{"type": "pause"}` | Advanced Page | `command_received` | `"3"` | Sets `program_running: false`, pauses active motion. |
| **`stow`** | `{"type": "stow"}` | Main Panel / Advanced | `command_received` | `"4"` | Sets `initialized: false`, `robot_mode: "POWER_OFF"`, parks robot arm. |
| **`turn_robot_off`**| `{"type": "turn_robot_off"}`| Advanced Page | `command_received` | `"5"` | Sets `robot_on: false`, `robot_mode: "POWER_OFF"`, locks Start. |
| **`abort`** | `{"type": "abort"}` | Advanced Page | `command_received` | `"5"` | Immediately halts process, sets `program_running: false`. |
| **`turn_robot_on`** | `{"type": "turn_robot_on"}` | Advanced Page | `command_received` | `"6"` | Sets `robot_on: true`, `robot_mode: "IDLE"`. |
| **`release_brakes`**| `{"type": "release_brakes"}`| Advanced Page | `command_received` | `"0"` | Sets `brakes_released: true`. |
| **`load_app`** | `{"type": "load_app", "data": {"app_name": "..."}}` | Home Screen Task Cards | `load_app` | `{"app_name": "...", "app_data": msg}` | Confirms app/recipe loaded on controller, shows toast notification. |
| **`bolt_config`** | `{"type": "bolt_config", "data": {"boltNum": 24, "torqueNum": 5}}` | Auto after `load_app` ack | `command_received` | `{"status": "ok", ...}` | Configures active bolt index and torque preset on the controller. |
| **`shutdown`** | `{"type": "shutdown"}` | Advanced Page | `command_received` | `""` | Logs shutdown acknowledgment. |
| **`connect`** | `{"type": "connect", "data": {"host": "...", "port": ...}}` | Advanced Page | `command_received` + `connection` | `{"connected": true}` | Turns connection dot **GREEN**. |
| **`disconnect`** | `{"type": "disconnect"}` | Advanced Page | `command_received` + `connection` | `{"connected": false}` | Turns connection dot **RED**, resets `initialized: false`. |
| **`move_x`** / **`move_y`** | `{"type": "move_x", "data": {"value": 1.0}}` | Move Pad / Keyboard | `command_received` | *code/status* | Jogs Cartesian axis position. |
| **`read_laser`** | `{"type": "read_laser"}` | Calibrate Page | `command_received` | `{"value": ..., "unit": "mm"}` | Updates live laser reading on Calibrate screen. |
| **`caliberation`** | `{"type": "caliberation", "data": "start"}` | Calibration Page (Home) | `command_received` | `{"status": "ok", "message": "..."}` | Runs the calibration routine. Toast shows the server's own message. |
| **`caliberation`** | `{"type": "caliberation", "data": "validate"}` | Calibration Page (Home) | `command_received` | `{"status": "ok"\|"error", "valid": bool, "message": "..."}` | Verifies the stored calibration. Red toast when `status: "error"`. |

---

## 4. Live Telemetry Protocol (`update_state` / `status_update`)

While a program is actively running following a `start` command, the backend streams high-frequency state updates.

### A. Telemetry Payload Schema
```json
{
  "type": "update_state",
  "data": {
    "robot_mode": "RUNNING",
    "current_command": "BOLTING_SEQUENCE",
    "program_running": true,
    "safety_status": "NORMAL",
    "process_progress": 16.7,
    "active_bolt": 4,
    "position": {
      "x": 124.50,
      "y": 88.20,
      "z": 15.00
    },
    "bolt_positions": {
      "1": { "status": "complete", "torque": 60 },
      "2": { "status": "complete", "torque": 40 },
      "3": { "status": "complete", "torque": 20 },
      "4": { "status": "in_progress", "torque": 40 },
      "5": { "status": "pending", "torque": 0 }
    }
  }
}
```

### B. Visualizer Logic on the Bolting Plate
Inside [BoltPlateVisual.jsx](frontend-react/src/components/BoltPlateVisual.jsx):
1. **Active Bolt (`active_bolt`):**
   * The bolt matching `data.active_bolt` pulses with an animated halo ring (`.bolt-marker.active`) and an amber/yellow warning glow.
2. **Completed Bolt (`status: "complete"`):**
   * The pulsing stops.
   * Color turns solid based on `data.bolt_positions[id].torque`:
     * `20` lb-in ➔ **Red** (`#ef4444`)
     * `40` lb-in ➔ **Amber** (`#f59e0b`)
     * `60` lb-in ➔ **Green** (`#22c55e`)
     * *Fallback:* If torque is omitted or unknown, completed bolts default to **Green**.
3. **Pending Bolt (`status: "pending"`):**
   * The marker remains hidden until the tool reaches that position.

---

## 5. Traffic Storage & Logging Architecture

Where are commands and responses recorded at runtime?

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                 COMMAND LOGGING                                  │
│                                                                                  │
│   Frontend RAM (logs[] state, max 1000)                                         │
│   ├── [client] {"type":"initialize"}         <-- Outbound from sendCommand()     │
│   └── [server] {"type":"command_received"}   <-- Inbound from handleMessage()    │
│                                                                                  │
│   Backend RAM (self.log_history[], max 500)                                      │
│   ├── [browser] Command: INITIALIZE          <-- Received by handle_client()     │
│   └── [robot]   Response [INITIALIZE]: Code 1<-- Broadcast by add_log()          │
│                                                                                  │
│   Disk Storage (On Demand)                                                       │
│   └── User clicks "Export" in Logs Tab       <-- Downloads cobot_logs_<time>.txt │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1. In Frontend Memory (`AppContext.jsx`)
* **Array:** `const [logs, setLogs] = useState([]);`
* **Capacity:** Ring buffer capped at **1,000 entries** in browser RAM.
* **Tagging:**
  * Outbound commands carry `source: 'client'`.
  * Inbound responses carry `source: 'server'` or `'robot'`.
* **Developer Console:** Every outbound frame is echoed to `console.log('[WS-SEND]', ...)`, and every inbound frame to `console.log('[WS-RECV]', ...)`.

### 2. In Backend Memory (`mock_ws_server.py`)
* **List:** `self.log_history = []`
* **Capacity:** Ring buffer capped at **500 entries** in server RAM.
* **Reconnection Sync:** When a browser connects or reloads, the server transmits `{"type": "log_history", "data": self.log_history[-100:]}` so the UI immediately shows recent history.

### 3. Persistent Disk Export
* To save commands to a permanent file, open the **Logs** tab (`/bolt/logs`) and click **`Export`**.
* The browser immediately creates and downloads a plain text file (`cobot_logs_<timestamp>.txt`) containing formatted timestamps, severity levels, source tags, and raw JSON payloads.

---

## 6. Detailed End-to-End Command Walkthroughs

### Walkthrough A: Initialization Flow
1. **User clicks "Initialize"** on the Main Control Panel.
2. `MainPanelPage.jsx` calls `sendCommand('INITIALIZE')`.
3. `AppContext.jsx` creates `{"type": "initialize"}` and appends `[client] {"type": "initialize"}` to `logs`.
4. `useWebSocket.js` transmits the frame over the wire:
   ```text
   Browser ──► Backend:  {"type":"initialize"}
   ```
5. Backend (`mock_ws_server.py`) sleeps for the configured 2.0s delay.
6. Backend sets `initialized = True`, `robot_mode = "IDLE"`.
7. Backend sends reply:
   ```text
   Backend ──► Browser:  {"type":"command_received","data":"1"}
   ```
8. `useWebSocket.js` receives the frame and passes it to `handleMessage()` in `AppContext.jsx`.
9. `AppContext.jsx` extracts `dataCode = "1"`, maps it via `RESPONSE_CODE_MAP["1"]` to `"initialize"`.
10. `AppContext.jsx` executes:
    * `setTcpConnected(true)` (Green dot in Header).
    * `setRobotStatus(prev => ({ ...prev, initialized: true, robot_mode: 'IDLE' }))`.
    * `showToast("initialize acknowledged (1)", "success")`.
11. `MainPanelPage.jsx` re-renders:
    * `isStartDisabled = !robotStatus.initialized || programRunning` evaluates to **`false`**.
    * **The Start button unlocks immediately.**

---

### Walkthrough B: Start & Bolting Flow
1. **User clicks "Start"** (now enabled).
2. `useWebSocket.js` transmits `{"type": "start"}`.
3. Backend starts bolting simulation task in background and acknowledges:
   ```text
   Backend ──► Browser:  {"type":"command_received","data":"2"}
   ```
4. `AppContext.jsx` maps code `"2"` to `"start"`, sets `program_running: true`.
5. UI disables Start and Stow buttons (cannot trigger motions during active execution).
6. Backend begins streaming `update_state` messages:
   * **Bolt 1:** `active_bolt: 1` ➔ Bolt 1 pulses on screen.
   * **Bolt 1 Complete:** `bolt_positions[1].status = "complete"`, `torque = 60` ➔ Bolt 1 turns solid Green.
   * **Bolt 2:** `active_bolt: 2` ➔ Pulses Bolt 2.
7. Upon Bolt 24 completion, backend sets `program_running: false` and emits final status. Start and Stow buttons unlock for the next cycle.

---

### Walkthrough C: Calibration Flow (Pre-Task)

Calibration is **not** part of the 6-step task flow above. It is a standalone step
run from the Home screen *before* a task is loaded, so it never sends `load_app`
and does not require `initialized === true`.

> **Spelling:** the wire `type` is `caliberation` (as specified by the robot side).
> Every UI label and internal identifier uses `calibration`. The mismatch is
> deliberate — changing one without the other breaks the protocol.

1. **User taps the "Calibration" card** on the Home screen.
2. `HomePage.jsx` calls `navigate('/calibration')` directly — deliberately **not**
   `handleSelect()`, because `selectTask()` would fire a `load_app` and calibration
   is not an app.
3. `CalibrationPage.jsx` renders two actions. Both are disabled unless
   `tcpConnected` is true; a status pill reads "Robot offline" when the link is down.
4. **User clicks "Start Calibration"** ➔ `sendCommand('CALIBERATION', 'start')`.
5. `AppContext.jsx` serializes a **scalar** payload:
   ```text
   Browser ──► Backend:  {"type":"caliberation","data":"start"}
   ```
6. Backend runs the routine (3.0 s in the mock), marks the calibration valid, and replies:
   ```text
   Backend ──► Browser:  {"type":"command_received","data":{"status":"ok","message":"Calibration routine complete"}}
   ```
7. `handleMessage()` finds no `RESPONSE_CODE_MAP` entry (the code is `"ok"`, not a
   digit), so it falls through to the message-text chain. Because the text contains
   `"calibrat"`, `commandName` resolves to `"calibration"`.
8. The `calibration` branch raises a toast carrying the **server's own message**,
   coloured red when `status` is `"error"`. Without this branch these replies would
   match the silent `ack` path and the buttons would give no feedback.
9. **User clicks "Validate Calibration"** ➔ `{"type":"caliberation","data":"validate"}`.
   The backend answers `status: "ok", valid: true` only if a routine has completed;
   otherwise `status: "error"` with `"No calibration to validate"`.

```text
{"type":"caliberation","data":"validate"}   ──►  status "error"  (nothing calibrated yet)
{"type":"caliberation","data":"start"}      ──►  status "ok"     (routine complete)
{"type":"caliberation","data":"validate"}   ──►  status "ok", valid true
```
