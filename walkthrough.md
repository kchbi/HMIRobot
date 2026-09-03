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
