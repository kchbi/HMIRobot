# Initialize & Control Flow Diagram (Current Architecture)

This document diagrams the complete lifecycle of the **Initialize**, **Start**, and **Stow** commands, button interlocks, network payloads, state mutations, and visual resets in the current architecture.

> [!NOTE]
> **Calibration happens before any of this.** The Calibration page is reached from
> the Home screen (`/calibration`), not from a task, and does not require
> `initialized === true`. See [Section 5](#5-upstream-calibration-before-initialize)
> and `COMMAND_PROTOCOL.md` → Walkthrough C.

---

## 1. Sequence Diagram: Complete Initialize Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as MainPanelPage (UI)
    participant AppContext as AppContext (sendCommand)
    participant useWS as useWebSocket.js
    participant Network as WebSocket Wire
    participant Backend as Backend (mock_ws_server / Controller)
    participant Dispatcher as AppContext (handleMessage)

    User->>UI: Clicks "Initialize" button
    UI->>AppContext: sendCommand('INITIALIZE')
    AppContext->>AppContext: Appends [client] {"type":"initialize"} to logs[]
    AppContext->>useWS: rawSendCommand('INITIALIZE')
    useWS->>Network: ws.send('{"type":"initialize"}')
    Note over useWS: Fire-and-forget (No Promise, No FIFO queue)

    Note over Network,Backend: --- Network Transmission ---

    Network->>Backend: Receives {"type":"initialize"}
    Backend->>Backend: cmd_type = "initialize"
    Backend->>Backend: Homing kinematics & self-test (2.0s delay)
    Note over Backend: NO update_state messages sent! Only single acknowledgment.
    Backend->>Network: Emits {"type":"command_received","data":"1"}

    Note over Network,Dispatcher: --- Response Arrives ---

    Network->>useWS: ws.onmessage event fires
    useWS->>useWS: JSON.parse() → {type:"command_received", data:"1"}
    useWS->>Dispatcher: onMessage(parsed) → handleMessage()

    Dispatcher->>Dispatcher: Matches dataCode "1" via RESPONSE_CODE_MAP["1"] → "initialize"
    Dispatcher->>Dispatcher: setTcpConnected(true) → Header connection dot turns GREEN
    Dispatcher->>Dispatcher: setRobotStatus({ initialized: true, robot_mode: 'IDLE', active_bolt: null, bolt_positions: {}, process_progress: 0 })
    Dispatcher->>Dispatcher: showToast("initialize acknowledged (1)", "success")
    Dispatcher->>Dispatcher: Appends [server] {"type":"command_received","data":"1"} to logs[]

    Dispatcher->>UI: Triggers React Re-render

    UI->>UI: Start button: (!isInitialized || programRunning) → ENABLED ✅
    UI->>UI: Stow button: (!isInitialized && !programRunning) → ENABLED ✅
    UI->>UI: Initialize button: (isInitialized || programRunning) → DISABLED 🔒
    UI->>UI: Plate Visual: Cleansed / reset (no pulsing rings, clean plate)
    UI->>UI: Header Dot: GREEN
    UI->>UI: Toast: "initialize acknowledged (1)"

    Note over User,Backend: Telemetry stream (update_state) begins ONLY after user clicks START!
```

---

## 2. Button Interlock State Machine

The control buttons (`Initialize`, `Start`, `Stow`) transition strictly according to this truth table in [`MainPanelPage.jsx`](frontend-react/src/pages/MainPanelPage.jsx#L14-L35):

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             BUTTON LIFECYCLE STATES                              │
│                                                                                  │
│   [1. STARTUP / STOWED]                                                         │
│   • Initialize: ENABLED                                                          │
│   • Start:      DISABLED (not initialized)                                       │
│   • Stow:       DISABLED (already parked)                                        │
│           │                                                                      │
│           │ User clicks Initialize (Ack "1")                                     │
│           ▼                                                                      │
│   [2. INITIALIZED / IDLE]                                                        │
│   • Initialize: DISABLED (already initialized)                                   │
│   • Start:      ENABLED  (ready to execute)                                      │
│   • Stow:       ENABLED  (can park back)                                         │
│           │                                                                      │
│           │ User clicks Start (Ack "2")                                          │
│           ▼                                                                      │
│   [3. RUNNING / BOLTING]                                                         │
│   • Initialize: DISABLED (cannot init while moving)                              │
│   • Start:      DISABLED (already running)                                       │
│   • Stow:       ENABLED  (can park/halt process at any time)                     │
│           │                                                                      │
│           │ User clicks Stow (Ack "4")                                           │
│           ▼                                                                      │
│   [4. HALTED & STOWED] (Returns to State 1)                                      │
│   • Initialize: ENABLED                                                          │
│   • Start:      DISABLED                                                         │
│   • Stow:       DISABLED                                                         │
│   • Plate:      Visuals completely wiped clean                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Step-by-Step Code Walkthrough

### Step 1: User Clicks "Initialize"

**File:** [`MainPanelPage.jsx`](frontend-react/src/pages/MainPanelPage.jsx)

```jsx
const isInitialized = !robotStatus.initialized;
const programRunning = !robotStatus.program_running;
const initializing = robotStatus.robot_mode === 'INITIALIZING';

// 1. Initialize is enabled only when NOT initialized and NOT running
const isInitializeDisabled = isInitialized || initializing || programRunning;

// 2. Start is enabled only when initialized and NOT running
const isStartDisabled = !isInitialized || programRunning;

// 3. Stow is enabled when initialized OR running (can stow from idle or running)
const isStowDisabled = !isInitialized && !programRunning;

const CONTROLS = [
    { action: 'INITIALIZE', label: 'Initialize', disabled: isInitializeDisabled },
    { action: 'START', label: 'Start', disabled: isStartDisabled },
    { action: 'STOW', label: 'Stow', disabled: isStowDisabled },
];

// Click dispatches action directly:
<button disabled={btn.disabled} onClick={() => sendCommand(btn.action)}>
    {btn.label}
</button>
```

---

### Step 2: AppContext.sendCommand() — Outbound Logging & Dispatch

**File:** [`AppContext.jsx`](frontend-react/src/context/AppContext.jsx#L161-L181)

```jsx
const sendCommand = useCallback((action, params = {}) => {
    // 1. Format payload: { "type": "initialize" }
    const msg = { type: action.toLowerCase() };
    // params may be an object of fields, or a scalar payload
    // (e.g. {"type": "calibration", "data": "start"})
    if (params !== null && params !== undefined) {
        if (typeof params === 'object') {
            if (Object.keys(params).length) msg.data = params;
        } else {
            msg.data = params;
        }
    }
    const rawSent = JSON.stringify(msg);

    // 2. Append to in-memory audit log
    setLogs((prev) => {
        const next = [...prev, {
            timestamp: Date.now() / 1000,
            level: 'INFO',
            source: 'client',
            message: rawSent,
        }];
        return next.length > 1000 ? next.slice(next.length - 1000) : next;
    });

    // 3. Low-level wire send (no FIFO, no Promise)
    rawSendCommand(action, params);
}, [rawSendCommand]);
```

---

### Step 3: useWebSocket.js — Direct Wire Send

**File:** [`useWebSocket.js`](frontend-react/src/hooks/useWebSocket.js#L92-L104)

```jsx
const sendCommand = useCallback((action, params = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('[WS] Not connected, cannot send:', action);
        return;
    }

    const msg = { type: action.toLowerCase() };
    // Scalar payloads pass straight through; objects are spread as `data`
    if (params !== null && params !== undefined) {
        if (typeof params === 'object') {
            if (Object.keys(params).length) msg.data = params;
        } else {
            msg.data = params;
        }
    }
    ws.send(JSON.stringify(msg)); // Transmitted over WebSocket
}, []);
```

**Over the wire:**
```json
{"type": "initialize"}
```

---

### Step 4: Backend Execution & Single Response

**File:** [`backend/mock_ws_server.py`](backend/mock_ws_server.py)

```python
elif cmd_type == "initialize":
    self.robot.robot_mode = "INITIALIZING"
    self.robot.current_command = "INITIALIZING"
    # Delay: 2.0 seconds
    # Response code: "1"
```

The server finishes initialization and emits **only one frame**:
```json
{"type": "command_received", "data": "1"}
```

> [!NOTE]
> The backend does **not** stream `update_state` during initialization.

---

### Step 5: Inbound Dispatch & State Mutation

**File:** [`AppContext.jsx`](frontend-react/src/context/AppContext.jsx#L68-L115)

```jsx
case 'command_received': {
    // 5a. Extract dataCode ("1")
    let rawCode = message.data;
    const dataCode = String(rawCode ?? '').trim();

    // 5b. Match via lookup table
    const commandName = RESPONSE_CODE_MAP[dataCode]; // "1" -> "initialize"

    // 5c. Set TCP connected (Green dot)
    setTcpConnected(true);

    // 5d. Mutate robot state and reset visual buffers
    switch (commandName) {
        case 'initialize':
            setRobotStatus(prev => ({
                ...prev,
                initialized: true,         // ← UNLOCKS START BUTTON
                robot_mode: 'IDLE',
                program_running: false,
                active_bolt: null,         // ← CLEARS VISUAL ACTIVE BOLT
                process_progress: 0,       // ← RESETS PROGRESS
                bolt_positions: {},        // ← CLEANS BOLTING PLATE
            }));
            break;
        // ...
    }

    // 5e. Toast notification & console logging
    showToast(`${commandName} acknowledged (${dataCode})`, 'success');
    break;
}
```

---

### Step 6: UI Re-render & Visualizer Behavior

1. **Button States Update:**
   * **`Start`**: `!isInitialized` becomes `false` ➔ **ENABLED**.
   * **`Stow`**: `!isInitialized && !programRunning` becomes `false` ➔ **ENABLED**.
   * **`Initialize`**: `isInitialized` becomes `true` ➔ **DISABLED**.
2. **Plate Visualizer ([`BoltPlateVisual.jsx`](frontend-react/src/components/BoltPlateVisual.jsx)):**
   * Active bolt pulsing is strictly gated:
     ```javascript
     const reported = (bolting && activeBolt !== null) ? String(activeBolt) : null;
     ```
   * Because `bolting` (`programRunning`) is `false`, **no halo rings pulse**. The plate remains clean and ready for execution.
3. **Header Indicator ([`Header.jsx`](frontend-react/src/components/Header.jsx)):**
   * `tcpConnected === true` ➔ Green status dot.
4. **Logs Tab ([`LogsPage.jsx`](frontend-react/src/pages/LogsPage.jsx)):**
   * Displays the paired entries:
     ```text
     [client]  {"type":"initialize"}
     [server]  {"type":"command_received","data":"1"}
     ```

---

## 4. What Happens Next: Transition to Start & Bolting

When the operator clicks **Start**:

```
Browser  ──────────────────────────►  Backend
         {"type":"start"}

Backend  ──────────────────────────►  Browser
         {"type":"command_received","data":"2"}

Backend  ══════════════════════════►  Browser (Telemetry Stream Active)
         {"type":"update_state","data":{"program_running":true,"active_bolt":1,...}}
         {"type":"update_state","data":{"program_running":true,"active_bolt":2,...}}
         ...
```

* Response code `"2"` arrives.
* `program_running` flips to `true`.
* **`Start`** disables, **`Initialize`** stays disabled, **`Stow` stays ENABLED**.
* Bolt 1 begins pulsing with the yellow ring on the plate visualizer.
* Telemetry streams continuously until all bolts complete or until the operator clicks **Stow**.

---

## 5. Upstream: Calibration Before Initialize

Calibration sits **outside** the Initialize ➔ Start ➔ Stow interlock entirely. It is
a standalone pre-task step with its own route and its own gate.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          OPERATOR JOURNEY (FULL)                                 │
│                                                                                  │
│   [HOME SCREEN]                                                                  │
│      │                                                                           │
│      ├─► "Calibration" card ──► /calibration                                     │
│      │      • Gate: tcpConnected only (NOT initialized)                          │
│      │      • Start Calibration     {"type":"calibration","data":"start"}       │
│      │      • Validate Calibration  {"type":"calibration","data":"validate"}    │
│      │      • No load_app — calibration is not an app                            │
│      │                                                                           │
│      └─► "Top Plate Bolting" card ──► selectTask('bolt') ──► /bolt               │
│             • Fires load_app + bolt_config                                       │
│             • THEN the Initialize / Start / Stow flow in Sections 1–4 applies    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Why it is not a task tab

An earlier revision placed this inside the bolt tab bar. It was moved because the
tab bar only exists *after* a task is loaded, which is too late — calibration is
something you do first. The pre-existing **Calibrate** tab (`/:task/calibrate`:
Go/Set positions, laser TCP, Read Laser) is a different screen and still lives
inside the task.

### Interlock comparison

| Screen | Gate | Requires `initialized` | Sends `load_app` |
| :--- | :--- | :---: | :---: |
| Main Panel (`/bolt`) | `initialized` + `program_running` | Yes | Yes (on task select) |
| Calibration (`/calibration`) | `tcpConnected` only | No | No |

### Response dispatch

Unlike `initialize` (code `"1"`), calibration replies carry no numeric code, so
`RESPONSE_CODE_MAP` misses and `handleMessage()` falls through to the message-text
chain:

```javascript
if (!commandName) {
    if (messageText.toLowerCase().includes('calibrat')) {
        commandName = 'calibration';          // ← matched here
    } else if (messageText.toLowerCase().includes('bolt')) {
        ...
}

// Toast carries the server's own message, red on failure
if (commandName === 'calibration') {
    const failed = dataCode.toLowerCase() === 'error';
    showToast(messageText || 'Calibration acknowledged', failed ? 'error' : 'success');
}
```

> [!IMPORTANT]
> The wire `type` is `calibration`; the UI label and every internal identifier is
> `calibration`. This mismatch is deliberate — do not "fix" one side alone.
