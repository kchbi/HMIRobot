# Communication

## 1. Architecture

```text
React
  ↓ WebSocket / JSON
FastAPI
  ↓ TCP / JSON + newline
Robot / Mock Robot
```

Two separate connections:

* **React ↔ FastAPI** — WebSocket, `ws://<host>/ws` (dev: Vite `:5173` proxies to FastAPI `:8001`)
* **FastAPI ↔ Robot** — TCP, `127.0.0.1:9999` (mock robot, or a real controller set via `CONNECT`)

Files: `frontend-react/src/hooks/useWebSocket.js`, `backend/main.py`, `backend/tcp_client.py`, `backend/command_protocol.py`, `backend/mock_tcp_server.py`.

## 2. Frontend → Backend

All commands go through `sendCommand(action, params)` in `useWebSocket.js`.

```json
{
  "action": "START",
  "params": {},
  "id": 2
}
```

* `action` — command name
* `params` — command data
* `id` — incrementing number, matches the response back to the caller

Commands in the code:

| Command | Params | Sent from |
|---|---|---|
| `INITIALIZE` / `START` / `STOW` | — | MainPanelPage buttons |
| `SET_TASK` | `{task}` | AppContext, TaskLayout |
| `MOVE_X` / `MOVE_Y` / `MOVE_Z` | `{value}` | RobotMovePad (buttons, WASD/arrows) |
| `SET_CALIBRATION` / `GO_CALIBRATION` | `{position}` | CalibratePage |
| `READ_LASER` | — | CalibratePage |
| `UPDATE_LASER_TCP` | `{x, y, z}` | CalibratePage |
| `CONNECT` | `{host, port}` | AdvancedPage — handled by FastAPI, not forwarded |
| `DISCONNECT` | — | AdvancedPage — handled by FastAPI, not forwarded |
| `GET_STATUS`, `ABORT`, `HOME`, `GET_PROGRESS` | free-form JSON | AdvancedPage console only |

`STOP` exists in the protocol but has no UI control.

## 3. Backend → Robot

`build_command()` in `command_protocol.py`:

```json
{
  "action": "START",
  "params": {}
}
```

* JSON, UTF-8
* newline (`\n`) terminated
* sent over TCP to `127.0.0.1:9999`
* no request `id` — replies are matched by order only

## 4. Robot → Backend

```json
{
  "status": "ok",
  "message": "Program started"
}
```

`tcp_client.send_command()` reads one newline-delimited line (`reader.readline()`, 10 s timeout) and `parse_response()` parses it as JSON. Parse failures return `{"status": "error", ...}` instead of raising.

## 5. Backend → Frontend

```json
{
  "type": "command_response",
  "action": "START",
  "id": 2,
  "data": {
    "status": "ok",
    "message": "Program started"
  }
}
```

React matches `id` to the pending `sendCommand` promise (15 s timeout).

Message types:

| Type | Meaning |
|---|---|
| `status_update` | Robot state, ~1/s, broadcast to all clients |
| `connection` | `{tcp_connected}` — on WS connect, `CONNECT`, `DISCONNECT` |
| `log` | Single log entry, broadcast |
| `log_history` | Last 100 log entries, on WS connect |
| `command_response` | Reply to one command |
| `error` | Invalid JSON, or TCP client unavailable |

## 6. Status Flow

```text
FastAPI
  ↓ GET_STATUS every ~1 sec
Robot
  ↓ status response
FastAPI
  ↓ status_update
React
```

Status is **polled by the backend** (`_status_poll_loop` in `tcp_client.py`), not pushed by the robot. The loop starts on TCP connect and runs even with no browser connected.

## 7. One Complete Example — START

```text
React
 ↓ WebSocket
FastAPI
 ↓ TCP
Robot
 ↑ TCP response
FastAPI
 ↑ WebSocket
React
```

React → FastAPI (WebSocket):

```json
{"action": "START", "params": {}, "id": 2}
```

FastAPI → Robot (TCP, newline terminated):

```json
{"action": "START", "params": {}}
```

Robot → FastAPI (TCP, newline terminated):

```json
{"status": "ok", "message": "Program started"}
```

FastAPI → React (WebSocket):

```json
{"type": "command_response", "action": "START", "id": 2,
 "data": {"status": "ok", "message": "Program started"}}
```

React resolves the promise, shows a toast; the next `status_update` (~1 s) updates the panel and plate.

## 8. Known Issues

* `DISCONNECT` does not return a `command_response` — the frontend promise times out after 15 s.
* TCP has no request/correlation ID; replies are matched by order.
* Status polling and user commands share one TCP connection.
* A TCP read timeout leaves the late response in the buffer — every later reply can be off by one.
* TCP reconnect is not automatic: `RobotTCPClient.reconnect()` is never called, and the poll loop exits on disconnect.
* A dropped TCP link broadcasts no `connection` message — the UI keeps showing "Connected".
* Lazy reconnect inside `send_command()` broadcasts no `connection` message either.
* `SET_TASK` is sent twice per task selection (AppContext + TaskLayout).
* `CONNECT`'s response `data` has no `status` field, unlike every other response.
* `status_update` is unwrapped to `data`, but a manual `GET_STATUS` returns the full envelope.
* REST endpoints (`/api/status`, `/api/config`, `/api/logs`, `/api/commands`) exist but the frontend never calls them.
* The robot JSON protocol is a project placeholder; the `ur_*.json` files are documentation and are not read by any code.
