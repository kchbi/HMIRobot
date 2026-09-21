# Protocol Alignment Walkthrough

## Summary of Changes

5 files modified, 1 dist rebuilt. The entire communication protocol was changed from FIFO-queue + object responses to fire-and-forget + data-code matching.

---

## File 1: [`useWebSocket.js`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/hooks/useWebSocket.js)

**Why:** FIFO Promise queue is no longer needed — responses are identified by their data code.

| Removed | Reason |
|:---|:---|
| `pendingRef` (FIFO queue) | Data codes identify responses, no ordering needed |
| `Promise` return from `sendCommand` | Fire-and-forget, no waiting |
| FIFO `shift()` in `onmessage` | Just dispatches to `handleMessage` directly |
| 15-second timeout | No Promise to timeout |

`sendCommand` is now 5 lines: build JSON → `ws.send()` → done.

---

## File 2: [`AppContext.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/context/AppContext.jsx)

**Why:** Core protocol handler. Had to change from `data.status === 'ok'` (object) to `RESPONSE_CODE_MAP[data]` (string code).

| Removed | Reason |
|:---|:---|
| `pendingCommandsRef` | Replaced by `RESPONSE_CODE_MAP` lookup |
| `boltCounterRef` | No more `bolt_config` step |
| `sendStartCommand` | Start now sends just `{"type":"start"}` |
| `data.status === 'ok'` checks | Data is a string like `"1"`, not an object |

| Added | Purpose |
|:---|:---|
| `RESPONSE_CODE_MAP` | `{"0":"release_brakes", "1":"initialize", "2":"start", "3":"pause", "4":"stow", "5":"turn_robot_off", "6":"turn_robot_on"}` |
| State handling for `turn_robot_on` | Sets `robot_on: true` |
| State handling for `turn_robot_off` | Sets `robot_on: false, initialized: false` |
| State handling for `release_brakes` | Sets `brakes_released: true` |
| State handling for `pause` | Sets `program_running: false` |

---

## File 3: [`MainPanelPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/MainPanelPage.jsx)

**Why:** Start button no longer needs `sendStartCommand` wrapper.

| Before (line 34) | After (line 34) |
|:---|:---|
| `onClick={() => btn.action === 'START' ? sendStartCommand() : sendCommand(btn.action)}` | `onClick={() => sendCommand(btn.action)}` |

All 3 buttons (Initialize, Start, Stow) now use the same `sendCommand()` call.

---

## File 4: [`AdvancedPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/AdvancedPage.jsx)

**Why:** Console dropdown needs all protocol commands for testing.

| Before | After |
|:---|:---|
| `GET_STATUS, INITIALIZE, START, STOW, ABORT, HOME, READ_LASER, GET_PROGRESS` | `TURN_ROBOT_ON, TURN_ROBOT_OFF, RELEASE_BRAKES, INITIALIZE, START, PAUSE, ABORT, STOW, LOAD_APP, SHUTDOWN, GET_STATUS` |

---

## File 5: [`mock_ws_server.py`](file:///home/adi/Desktop/GUIRev2/backend/mock_ws_server.py)

**Why:** Mock responses must match real backend format.

| Before | After |
|:---|:---|
| `{"type":"command_received","data":{"status":"ok","message":"Robot initialized"}}` | `{"type":"command_received","data":"1"}` |

Full COMMAND_CONFIG now matches the excel:

| Command | Response `data` | Delay |
|:---|:---|:---|
| `turn_robot_off` | `"5"` | 1.0s |
| `turn_robot_on` | `"6"` | 1.0s |
| `release_brakes` | `"0"` | 1.5s |
| `initialize` | `"1"` | 2.0s |
| `start` | `"2"` | 0.5s |
| `pause` | `"3"` | 0.1s |
| `abort` | `"5"` | 0.1s |
| `stow` | `"4"` | 2.5s |
| `load_app` | object | 0.5s |
| `shutdown` | `""` | 1.0s |

---

## Protocol Flow (After Changes)

```
Browser sends:     {"type":"initialize"}
Backend responds:  {"type":"command_received","data":"1"}
                                                    ↑
                                         String "1" → RESPONSE_CODE_MAP → "initialize"
                                                    → setRobotStatus({initialized: true})
                                                    → setTcpConnected(true) → green dot
                                                    → showToast("initialize acknowledged (1)")
```

## New dist
Built: `dist/assets/index-lXFL7Mjz.js` (replaces old `index-CGJNzQjT.js`)

---
---

# Calibration Page Walkthrough

## Summary of Changes

2 files added, 8 modified. Calibration became a standalone step reached from the
Home screen — it is something you run *before* starting a task, so it no longer
lives inside a task's tab bar.

> **Note on spelling:** the wire protocol uses `calibration` (as specified by the
> robot side). The UI label and all internal identifiers use `calibration`. This
> mismatch is deliberate — do not "fix" one without the other.

---

## File 1: [`CalibrationPage.jsx`](frontend-react/src/pages/CalibrationPage.jsx) — NEW

The whole page. Two actions, nothing else.

| Element | Sends |
|:---|:---|
| **Start Calibration** | `{"type": "calibration", "data": "start"}` |
| **Validate Calibration** | `{"type": "calibration", "data": "validate"}` |

Because it is a pre-task step, it does **not** depend on `initialized` or on a
loaded app. The only gate is `tcpConnected` — both buttons disable and a status
pill reads "Robot offline" when the link is down.

It renders its own `<Header />` and `<ToastContainer />` rather than inheriting
them, since it sits outside `TaskLayout`.

## File 2: [`CalibrationPage.css`](frontend-react/src/pages/CalibrationPage.css) — NEW

Card layout built entirely from [`tokens.css`](frontend-react/src/styles/tokens.css).
Start is the navy filled primary; Validate is the light outlined secondary. Both
are 96px-tall touch rows (72px under `max-height: 800px`) carrying an icon tile,
a label and a one-line hint.

---

## File 3: [`App.jsx`](frontend-react/src/App.jsx)

**Why:** the page is not a task, so it must not sit under `/:task`.

| Before | After |
|:---|:---|
| `<Route path="calibration">` nested inside `/:task` | `<Route path="/calibration">` at top level |

Declared ahead of `/:task` so the static segment wins. `/bolt/calibration` now
falls through to the catch-all and redirects Home.

## File 4: [`TabBar.jsx`](frontend-react/src/components/TabBar.jsx)

**Why:** removed from the task tab bar.

| Before | After |
|:---|:---|
| `Main, Vision, Logs, Calibrate, Calibration, Advanced` | `Main, Vision, Logs, Calibrate, Advanced` |

The pre-existing **Calibrate** tab (Go/Set positions, laser TCP, Read Laser) is
untouched — it is a different thing and still lives inside the task.

## File 5: [`HomePage.jsx`](frontend-react/src/pages/HomePage.jsx)

**Why:** new entry point, sitting beside "Top Plate Bolting".

Added `CALIBRATION_CARD`. It is rendered outside the `TASKS.map()` and calls
`navigate('/calibration')` directly instead of `handleSelect()` — going through
`selectTask()` would fire a `LOAD_APP`, and calibration is not an app.

## File 6: [`useWebSocket.js`](frontend-react/src/hooks/useWebSocket.js) + File 7: [`AppContext.jsx`](frontend-react/src/context/AppContext.jsx)

**Why:** `data` was previously always an object.

| Before | After |
|:---|:---|
| `if (Object.keys(params).length) msg.data = params;` | scalar payloads pass through unchanged |

So `sendCommand('CALIBRATION', 'start')` emits `"data": "start"`, not
`"data": {...}`.

`AppContext` also gained a `calibration` branch in `command_received`. Without it
these replies matched the silent `ack` path and the buttons gave no feedback.
The toast now carries the server's own message and turns red on `status: "error"`.

## File 8: [`main.py`](backend/main.py)

**Why:** `tcp_client.send_command(action, **params)` throws on a string payload.

A non-dict `data` is normalized to `{"value": data}` before forwarding, so
`calibration` reaches the robot as `send_command("CALIBRATION", value="start")`.

## Files 9–10: [`command_protocol.py`](backend/command_protocol.py), [`mock_tcp_server.py`](backend/mock_tcp_server.py), [`mock_ws_server.py`](backend/mock_ws_server.py)

`CALIBRATION` constant plus handlers in both mocks:

| `data` | Behaviour |
|:---|:---|
| `"start"` | Runs a 3s simulated routine, then marks the calibration valid |
| `"validate"` | `ok` only if a routine has completed, else `error` |
| anything else | `error: Unknown calibration mode` |

---

## Protocol Flow

```
Browser sends:     {"type":"calibration","data":"start"}
Backend responds:  {"type":"command_received","data":{"status":"ok","message":"Calibration routine complete"}}
                                                                ↑
                                            message contains "calibrat" → commandName "calibration"
                                                                → showToast(message, status==="error" ? 'error' : 'success')
```

## Verification

Against `mock_ws_server.py`, sending exactly what the buttons emit:

| Sent | Received |
|:---|:---|
| `{"type":"calibration","data":"validate"}` | `{"status":"error","message":"No calibration to validate","valid":false}` |
| `{"type":"calibration","data":"start"}` | `{"status":"ok","message":"Calibration routine complete"}` |
| `{"type":"calibration","data":"validate"}` | `{"status":"ok","message":"Calibration validated","valid":true}` |

Plus a server-side render of the app (17 assertions) confirming the Home card,
the page's buttons and offline state, and that the Calibration tab is gone from
`/bolt` while `Calibrate` remains.

Not yet exercised in a browser or against real hardware.
