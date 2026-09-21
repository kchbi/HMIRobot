# Complete Frontend Codebase & Function Guide (`frontend-react`)

This document is a comprehensive, function-by-function manual for the entire `frontend-react` codebase. It details every single file, component, hook, utility, and server script in the project, explaining what every function does, its parameters, return values, internal mechanics, and interaction with the robot hardware.

---

# Table of Contents

1. [Architectural Overview & Data Flow](#1-architectural-overview--data-flow)
2. [Application Bootstrap & Routing](#2-application-bootstrap--routing)
   - [2.1 `index.html`](#21-indexhtml)
   - [2.2 `vite.config.js`](#22-viteconfigjs)
   - [2.3 `package.json`](#23-packagejson)
   - [2.4 `src/main.jsx`](#24-srcmainjsx)
   - [2.5 `src/App.jsx`](#25-srcappjsx)
   - [2.6 `src/index.css`](#26-srcindexcss)
3. [Networking & Global State Management](#3-networking--global-state-management)
   - [3.1 `src/hooks/useWebSocket.js`](#31-srchooksusewebsocketjs)
   - [3.2 `src/context/AppContext.jsx`](#32-srccontextappcontextjsx)
4. [Domain Utilities & Hardware Coordinate Mapping](#4-domain-utilities--hardware-coordinate-mapping)
   - [4.1 `src/utils/robotModes.js`](#41-srcutilsrobotmodesjs)
   - [4.2 `src/components/boltPlateLayout.js`](#42-srccomponentsboltplatelayoutjs)
5. [UI Components](#5-ui-components)
   - [5.1 `src/components/Header.jsx`](#51-srccomponentsheaderjsx)
   - [5.2 `src/components/TabBar.jsx`](#52-srccomponentstabbarjsx)
   - [5.3 `src/components/StatusList.jsx`](#53-srccomponentsstatuslistjsx)
   - [5.4 `src/components/BoltPlateVisual.jsx`](#54-srccomponentsboltplatevisualjsx)
   - [5.5 `src/components/BoltPlateCanvas.jsx`](#55-srccomponentsboltplatecanvasjsx)
   - [5.6 `src/components/RobotMovePad.jsx`](#56-srccomponentsrobotmovepadjsx)
   - [5.7 `src/components/ProcessSteps.jsx`](#57-srccomponentsprocessstepsjsx)
   - [5.8 `src/components/ProgressBar.jsx`](#58-srccomponentsprogressbarjsx)
   - [5.9 `src/components/ProgressDonut.jsx`](#59-srccomponentsprogressdonutjsx)
   - [5.10 `src/components/TaskLayout.jsx`](#510-srccomponentstasklayoutjsx)
   - [5.11 `src/components/ToastContainer.jsx`](#511-srccomponentstoastcontainerjsx)
6. [Pages & Application Views](#6-pages--application-views)
   - [6.1 `src/pages/HomePage.jsx`](#61-srcpageshomepagejsx)
   - [6.2 `src/pages/MainPanelPage.jsx`](#62-srcpagesmainpanelpagejsx)
   - [6.3 `src/pages/VisionPage.jsx`](#63-srcpagesvisionpagejsx)
   - [6.4 `src/pages/CalibratePage.jsx`](#64-srcpagescalibratepagejsx)
   - [6.5 `src/pages/AdvancedPage.jsx`](#65-srcpagesadvancedpagejsx)
   - [6.6 `src/pages/LogsPage.jsx`](#66-srcpageslogspagejsx)
   - [6.7 `src/pages/DataPage.jsx`](#67-srcpagesdatapagejsx)
7. [Design System & CSS Styling](#7-design-system--css-styling)
   - [7.1 `src/styles/tokens.css`](#71-srcstylestokenscss)
   - [7.2 `src/styles/base.css`](#72-srcstylesbasecss)
8. [Production Static Server](#8-production-static-server)
   - [8.1 `serve.py`](#81-servepy)

---

# 1. Architectural Overview & Data Flow

The `frontend-react` application is a client-side Single Page Application (SPA) designed to serve as an industrial Human-Machine Interface (HMI) for Universal Robots cobots.

### Communication Architecture
1. **WebSocket Connection (`useWebSocket`)**: Establishes a persistent bidirectional connection between the browser and the backend WebSocket server (`ws://<host>:8080/ws`).
2. **Central State Machine (`AppContext`)**: Maintains all robot telemetry (`robot_mode`, `current_command`, `bolt_positions`, `safety_status`, `program_running`), log streams, toast notifications, and pending command handshakes.
3. **Sequential Async Request-Response Loop**: While bolting is active, dispatches asynchronous non-blocking `get_bolt_torque` requests, awaits controller feedback, updates UI torque colors, pauses for 500ms, and repeats.
4. **Hardware Representation**: Renders interactive SVG/HTML overlays representing the physical 24-bolt fixture with sub-pixel calibrated percentages.

---

# 2. Application Bootstrap & Routing

## 2.1 `index.html`
- **Path**: [`frontend-react/index.html`](file:///home/adi/Desktop/GUIRev2/frontend-react/index.html)
- **Role**: The HTML5 container document that hosts the single-page application.
- **Code**:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MO Cobot HMI</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```
- **Explanation**:
  - Sets up the viewport for fixed and touch industrial displays.
  - Pre-connects and imports the `Inter` font family from Google Fonts.
  - Declares `<div id="root"></div>` as the mount target for React.
  - Loads `/src/main.jsx` as an ES module.

---

## 2.2 `vite.config.js`
- **Path**: [`frontend-react/vite.config.js`](file:///home/adi/Desktop/GUIRev2/frontend-react/vite.config.js)
- **Role**: Configuration file for the Vite development and build tool.
- **Code**:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Listens on 0.0.0.0 for tablet/network access
  },
})
```
- **Explanation**:
  - `plugins: [react()]`: Enables Babel/SWC Fast Refresh and JSX transformation.
  - `server.port: 3000`: Sets the local development server port to `3000`.
  - `server.host: true`: Configures Vite to listen on `0.0.0.0`, allowing remote operators on the shop-floor network (e.g. tablet or teach pendant) to open the GUI.

---

## 2.3 `package.json`
- **Path**: [`frontend-react/package.json`](file:///home/adi/Desktop/GUIRev2/frontend-react/package.json)
- **Role**: Manifest defining project dependencies, scripts, and build metadata.
- **Key Sections**:
  - `"dependencies"`:
    - `react`: `^19.0.0` (Core React library)
    - `react-dom`: `^19.0.0` (DOM renderer for React)
    - `react-router-dom`: `^7.1.5` (Declarative client-side routing)
  - `"scripts"`:
    - `npm run dev`: Starts the local development server with HMR.
    - `npm run build`: Compiles production assets into `dist/`.
    - `npm run preview`: Locates and previews the compiled production build.

---

## 2.4 `src/main.jsx`
- **Path**: [`frontend-react/src/main.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/main.jsx)
- **Role**: Application entry point where React mounts to the DOM.
- **Code**:
```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
```
- **Execution Flow**:
  1. `createRoot(document.getElementById('root'))`: Attaches React to the root DOM node.
  2. `<StrictMode>`: Activates development checks for deprecated APIs and unintentional side effects.
  3. `<BrowserRouter>`: Initializes browser history routing context.
  4. `<AppProvider>`: Instantiates the global singleton state and WebSocket listener.
  5. `<App />`: Renders the top-level route tree.

---

## 2.5 `src/App.jsx`
- **Path**: [`frontend-react/src/App.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/App.jsx)
- **Role**: Defines the complete route hierarchy for all screens.
- **Functions in this file**:

### `App()`
- **Purpose**: Top-level functional component returning the route mapping.
- **Parameters**: None.
- **Returns**: JSX `<Routes>` structure.
- **Code**:
```javascript
export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/:task" element={<TaskLayout />}>
                <Route index element={<MainPanelPage />} />
                <Route path="vision" element={<VisionPage />} />
                <Route path="logs" element={<LogsPage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="calibrate" element={<CalibratePage />} />
                <Route path="advanced" element={<AdvancedPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
```
- **Mechanics**:
  - `path="/"`: Renders `HomePage` (recipe selection).
  - `path="/:task"`: Mounts `TaskLayout` which wraps sub-routes with `Header` and `TabBar`.
  - Nested routes:
    - Index route (`/:task`): `MainPanelPage` (live controls, status, bolting visualization).
    - `/:task/vision`: `VisionPage` (machine vision stream).
    - `/:task/logs`: `LogsPage` (system logs and export).
    - `/:task/data`: `DataPage` (database metrics placeholder).
    - `/:task/calibrate`: `CalibratePage` (laser measurement and jogging).
    - `/:task/advanced`: `AdvancedPage` (raw command console and TCP configuration).
  - `path="*"`: Catch-all that redirects any invalid route back to `/`.

---

## 2.6 `src/index.css`
- **Path**: [`frontend-react/src/index.css`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/index.css)
- **Role**: Top-level CSS file that imports design tokens and global styles.
- **Code**:
```css
@import './styles/tokens.css';
@import './styles/base.css';
```

---

# 3. Networking & Global State Management

## 3.1 `src/hooks/useWebSocket.js`
- **Path**: [`frontend-react/src/hooks/useWebSocket.js`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/hooks/useWebSocket.js)
- **Role**: Custom React hook managing the raw WebSocket client connection to the backend.
- **State & Refs**:
  - `connected` (`Boolean`): Whether the WebSocket connection is open.
  - `wsRef` (`Ref<WebSocket>`): Persistent reference to the active `WebSocket` instance.
  - `reconnectAttemptsRef` (`Ref<Number>`): Count of reconnect attempts.
  - `onMessageRef` (`Ref<Function>`): Mutable reference to the parent message handler, avoiding unnecessary reconnects on handler changes.

### Functions in `useWebSocket`:

#### 1. `connect()`
- **Purpose**: Establishes the WebSocket connection to the backend and configures event listeners.
- **Code**:
```javascript
const connect = useCallback(() => {
    const host = window.location.hostname || 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = (import.meta.env.VITE_WS_URL && !import.meta.env.VITE_WS_URL.includes('localhost'))
        ? import.meta.env.VITE_WS_URL
        : `${protocol}//${host}:8080/ws`;

    let ws;
    try {
        ws = new WebSocket(wsUrl);
    } catch (e) {
        console.error('[WS] Failed to create WebSocket:', e);
        scheduleReconnect();
        return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnected(true);
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            onMessageRef.current?.(message);
        } catch (e) {
            console.error('[WS] Failed to parse message:', e);
        }
    };

    ws.onclose = (event) => {
        setConnected(false);
        if (event.code !== 1000) {
            scheduleReconnect();
        }
    };

    ws.onerror = (error) => {
        console.error('[WS] Error:', error);
    };
}, []);
```
- **Mechanics**:
  - Determines the target host dynamically from `window.location.hostname`.
  - Connects to port `8080` path `/ws` by default or uses `VITE_WS_URL`.
  - Sets `ws.onmessage` to parse incoming JSON and forward it directly to `onMessageRef.current`.
  - If closed abnormally (`event.code !== 1000`), triggers `scheduleReconnect()`.

#### 2. `scheduleReconnect()`
- **Purpose**: Schedules an automatic reconnection attempt with capped exponential backoff.
- **Code**:
```javascript
const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log('[WS] Max reconnect attempts reached');
        return;
    }
    reconnectAttemptsRef.current += 1;
    const delay = RECONNECT_BASE_DELAY * Math.min(reconnectAttemptsRef.current, 5);
    setTimeout(connect, delay);
}, [connect]);
```
- **Mechanics**:
  - `MAX_RECONNECT_ATTEMPTS = 10`.
  - `RECONNECT_BASE_DELAY = 2000` (2 seconds).
  - Delay is `2000 * min(attempts, 5)` ms (maximum 10 seconds between tries).

#### 3. `sendCommand(action, params = {})`
- **Purpose**: Formats and sends a JSON command packet over the open WebSocket.
- **Parameters**:
  - `action` (`String`): The command type (e.g. `'START'`, `'INITIALIZE'`, `'MOVE_X'`).
  - `params` (`Object`): Optional data payload (e.g. `{ value: 1.0 }`).
- **Code**:
```javascript
const sendCommand = useCallback((action, params = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.warn('[WS] Not connected, cannot send:', action);
        return;
    }

    const msg = { type: action.toLowerCase() };
    if (Object.keys(params).length) {
        msg.data = params;
    }
    ws.send(JSON.stringify(msg));
}, []);
```

---

## 3.2 `src/context/AppContext.jsx`
- **Path**: [`frontend-react/src/context/AppContext.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/context/AppContext.jsx)
- **Role**: Core application state provider, command dispatcher, and message coordinator.

### Constant Maps
- `TASK_NAMES`: Maps IDs (`'bolt'`) to display strings (`'Top Plate Bolting'`).
- `TASK_APP_NAMES`: Maps IDs (`'bolt'`) to controller recipe names (`'TopPlateBolt'`).
- `RESPONSE_CODE_MAP`: Maps numeric data codes from `command_received` to actions:
  - `"0"`: `release_brakes`
  - `"1"`: `initialize`
  - `"2"`: `start`
  - `"3"`: `pause`
  - `"4"`: `abort`
  - `"5"`: `stow`
  - `"6"`: `turn_robot_off`
  - `"7"`: `turn_robot_on`

### State & Ref Variables in `AppProvider`

| Variable | Type | Purpose |
|---|---|---|
| `robotStatus` | `Object` | Active robot telemetry (`robot_mode`, `current_command`, `bolt_positions`, etc.). |
| `tcpConnected` | `Boolean` | True if backend has an active TCP socket to the robot controller. |
| `logs` | `Array` | Ring-buffer array of system logs, capped at 1000 lines. |
| `toasts` | `Array` | Array of active notification objects `{ id, message, type }`. |
| `laserReading` | `Object` | Most recent laser measurement `{ value, unit }`. |
| `currentTask` | `String` | Currently loaded task (`'bolt'`, `'clean'`, or `'gel'`). |
| `cdaPopup` | `Boolean` | Flag indicating whether Compressed Dry Air warning popup is visible. |
| `consoleLines` | `Array` | Command history array for the Advanced tab terminal. |
| `isBoltingPolling` | `Boolean` | Controls whether the 0.5s `get_bolt_torque` polling loop runs. |
| `pendingBoltConfigRef` | `Ref<Object>` | Stores `{ boltNum, torqueNum }` until `load_app` acknowledges. |
| `boltConfigTimeoutRef` | `Ref<Timeout>`| Safety fallback timer to dispatch `bolt_config` if `load_app` ack is slow. |
| `cameraListenersRef` | `Ref<Set>` | Set of callbacks subscribed to incoming `camera_frame` payloads. |
| `latestCameraFrameRef` | `Ref<Any>` | Caches the most recent camera frame for instant display. |
| `pendingBoltTorqueResolverRef` | `Ref<Function>` | Resolver function for the active Promise waiting for `get_bolt_torque`. |

### Functions in `AppContext.jsx`:

#### 1. `onCameraFrame(callback)`
- **Purpose**: Registers a subscriber callback for incoming camera frames.
- **Parameters**: `callback` (`Function`) receiving image data.
- **Returns**: An unsubscribe cleanup function.
- **Code**:
```javascript
const onCameraFrame = useCallback((callback) => {
    cameraListenersRef.current.add(callback);
    if (latestCameraFrameRef.current) {
        try {
            callback(latestCameraFrameRef.current);
        } catch (e) {
            console.error('[Vision] Initial frame callback error:', e);
        }
    }
    return () => {
        cameraListenersRef.current.delete(callback);
    };
}, []);
```

#### 2. `showToast(message, type = 'info')`
- **Purpose**: Displays a temporary notification banner at the top of the UI.
- **Parameters**:
  - `message` (`String`): Notification text.
  - `type` (`String`): `'info'`, `'success'`, `'warning'`, or `'error'`.
- **Code**:
```javascript
const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
}, []);
```

#### 3. `addConsoleLine(text, type = 'system')`
- **Purpose**: Appends a line of text to the Advanced Page command terminal.
- **Parameters**:
  - `text` (`String`): Message content.
  - `type` (`String`): `'system'`, `'sent'`, `'received'`, `'warning'`, or `'error'`.
- **Code**:
```javascript
const addConsoleLine = useCallback((text, type = 'system') => {
    consoleIdRef.current += 1;
    setConsoleLines((prev) => [...prev, { id: consoleIdRef.current, text, type }]);
}, []);
```

#### 4. `handleMessage(message)`
- **Purpose**: Central routing function for all incoming WebSocket JSON packets.
- **Parameters**: `message` (`Object`): Parsed JSON packet containing `type` and `data`.
- **Branching Logic by `message.type`**:

##### A. `case 'update_state' / 'status_update'`
- Normalizes robot mode using `formatRobotMode`.
- Preserves existing bolt torque colors only if Start has been clicked in this cycle (`hasBoltingRunStartedRef.current`):
```javascript
let mergedBolts = {};
if (
    hasBoltingRunStartedRef.current &&
    robotMode !== 'INITIALIZING' &&
    robotMode !== 'POWER_OFF' &&
    robotMode !== 'NO_CONTROLLER' &&
    robotMode !== 'DISCONNECTED'
) {
    mergedBolts = { ...(prev.bolt_positions || {}) };
    if (incoming.bolt_positions) {
        Object.entries(incoming.bolt_positions).forEach(([id, b]) => {
            mergedBolts[id] = {
                ...(mergedBolts[id] || {}),
                ...(typeof b === 'object' ? b : { color: b }),
            };
        });
    }
}
```

##### B. `case 'connection'`
- Updates `tcpConnected` state (`message.data?.tcp_connected`).
- Displays a toast message if connected.

##### C. `case 'command_received'`
- Extracts `dataCode` (e.g. `"1"` or `{"code": "1"}`) and resolves `commandName` from `RESPONSE_CODE_MAP`.
- Executes specific state updates per command:
  - **`'initialize'`**: Sets `initialized: true`, `robot_mode: 'IDLE'`, resets `hasBoltingRunStartedRef.current = false`, resets bolt arrays to default uncoloured state, and deliberately avoids querying torque before Start:
    ```javascript
    case 'initialize':
        hasBoltingRunStartedRef.current = false;
        setRobotStatus(prev => ({
            ...prev,
            initialized: true,
            robot_mode: 'IDLE',
            program_running: false,
            active_bolt: null,
            process_progress: 0,
            bolt_positions: {},
            bolt_torque_colors: [],
        }));
        break;
    ```
  - **`'start'`**: Sets `program_running: true` and `hasBoltingRunStartedRef.current = true`.
  - **`'pause'`**: Sets `program_running: false`.
  - **`'stow'` / `'turn_robot_off'` / `'abort'`**: Resets `initialized: false`, `robot_mode: 'POWER_OFF'`, `program_running: false`, `hasBoltingRunStartedRef.current = false`, and clears all bolt indicators to default uncoloured state.

##### D. `case 'load_app'`
- Confirms the recipe was loaded on the robot controller.
- Clears the fallback safety timeout.
- Immediately sends the pending `bolt_config` command:
```javascript
if (pendingBoltConfigRef.current) {
    const configToSend = pendingBoltConfigRef.current;
    pendingBoltConfigRef.current = null;
    sendCommandRef.current?.('BOLT_CONFIG', configToSend);
}
```

##### E. `case 'get_bolt_torque' / 'get_bolt_status'`
- Receives the 40-element array of color strings (e.g. `['lawngreen', 'yellow', 'white', ...]`).
- Resolves the active Promise awaiting response in `pendingBoltTorqueResolverRef`.
- Maps the colors to 1-indexed bolts (`1..24`) and marks any non-white bolt as `'complete'`.

##### F. `case 'camera_frame'`
- Saves image data to `latestCameraFrameRef`.
- Dispatches data to all active listener functions registered via `onCameraFrame`.

##### G. `case 'cda_popup'`
- Toggles `cdaPopup` boolean and displays a warning toast.

#### 5. `sendCommand(action, params = {})`
- **Purpose**: Higher-level wrapper around WebSocket `send` that provides logging, state machine gating, and immediate visual resets.
- **Code**:
```javascript
const sendCommand = useCallback((action, params = {}) => {
    const actionStr = String(action || '');
    const upper = actionStr.toUpperCase();
    const msg = { type: actionStr.toLowerCase() };
    if (Object.keys(params).length) {
        msg.data = params;
    }
    const rawSent = JSON.stringify(msg);

    // 1. Polling gate
    if (upper === 'START') {
        if (postRunTimerRef.current) {
            clearTimeout(postRunTimerRef.current);
            postRunTimerRef.current = null;
        }
        hasBoltingRunStartedRef.current = true;
        setIsBoltingPolling(true);
    } else if (['STOW', 'ABORT', 'PAUSE', 'INITIALIZE', 'TURN_ROBOT_OFF', 'DISCONNECT'].includes(upper)) {
        if (postRunTimerRef.current) {
            clearTimeout(postRunTimerRef.current);
            postRunTimerRef.current = null;
        }
        setIsBoltingPolling(false);
        if (['STOW', 'ABORT', 'INITIALIZE', 'TURN_ROBOT_OFF', 'DISCONNECT'].includes(upper)) {
            hasBoltingRunStartedRef.current = false;
        }
    }

    // 2. Instant Visualizer Reset on Initialize or Stow click
    if (upper === 'INITIALIZE' || upper === 'STOW') {
        if (postRunTimerRef.current) {
            clearTimeout(postRunTimerRef.current);
            postRunTimerRef.current = null;
        }
        hasBoltingRunStartedRef.current = false;
        setRobotStatus((prev) => ({
            ...prev,
            initialized: false,
            robot_mode: upper === 'INITIALIZE' ? 'INITIALIZING' : 'POWER_OFF',
            program_running: false,
            active_bolt: null,
            process_progress: 0,
            bolt_positions: {},
            bolt_torque_colors: [],
        }));
    }

    // 3. Log to Logs tab (skips get_bolt_torque polling spam)
    if (upper !== 'GET_BOLT_TORQUE' && upper !== 'GET_BOLT_STATUS') {
        setLogs((prev) => {
            const next = [...prev, {
                timestamp: Date.now() / 1000,
                level: 'INFO',
                source: 'client',
                message: rawSent,
            }];
            return next.length > 1000 ? next.slice(next.length - 1000) : next;
        });
    }

    rawSendCommand(action, params);
}, [rawSendCommand]);
```

#### 6. `requestBoltTorqueAsync(timeoutMs = 5000)`
- **Purpose**: Asynchronously sends `GET_BOLT_TORQUE` and returns a `Promise` that awaits the controller response without blocking the UI thread.
- **Parameters**: `timeoutMs` (`Number`): Maximum time to wait before timing out (default 5000ms).
- **Returns**: `Promise<Array|null>` resolving with the torque color array.
- **Code**:
```javascript
const requestBoltTorqueAsync = useCallback((timeoutMs = 5000) => {
    return new Promise((resolve) => {
        let timer = null;

        const resolver = (data) => {
            if (timer) clearTimeout(timer);
            resolve(data);
        };

        timer = setTimeout(() => {
            if (pendingBoltTorqueResolverRef.current === resolver) {
                pendingBoltTorqueResolverRef.current = null;
                resolve(null);
            }
        }, timeoutMs);

        pendingBoltTorqueResolverRef.current = resolver;
        sendCommand('GET_BOLT_TORQUE');
    });
}, [sendCommand]);
```

#### 7. Bolting Polling Loop (`useEffect`)
- **Purpose**: While `isBoltingPolling` is true and WebSocket is connected, executes a sequential ping-pong loop: sends `GET_BOLT_TORQUE`, awaits response, pauses 500ms, and repeats.
- **Code**:
```javascript
useEffect(() => {
    if (!isBoltingPolling || !wsConnected) {
        if (pendingBoltTorqueResolverRef.current) {
            pendingBoltTorqueResolverRef.current(null);
            pendingBoltTorqueResolverRef.current = null;
        }
        return;
    }

    let isCancelled = false;

    const runPollingLoop = async () => {
        while (!isCancelled && isBoltingPolling && wsConnected) {
            try {
                await requestBoltTorqueAsync(5000);
                if (isCancelled || !isBoltingPolling || !wsConnected) break;
                await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (err) {
                console.error('[WS] get_bolt_torque polling loop error:', err);
                break;
            }
        }
    };

    runPollingLoop();

    return () => {
        isCancelled = true;
        if (pendingBoltTorqueResolverRef.current) {
            pendingBoltTorqueResolverRef.current(null);
            pendingBoltTorqueResolverRef.current = null;
        }
    };
}, [isBoltingPolling, wsConnected, requestBoltTorqueAsync]);
```

#### 8. `selectTask(task, customBoltConfig = null)`
- **Purpose**: Loads a task recipe on the controller. When `'bolt'` is selected, configures `boltNum` (24) and `torqueNum` (3).
- **Parameters**:
  - `task` (`String`): `'bolt'`, `'clean'`, or `'gel'`.
  - `customBoltConfig` (`Object|null`): Optional override `{ boltNum, torqueNum }`.
- **Code**:
```javascript
const selectTask = useCallback((task, customBoltConfig = null) => {
    setCurrentTask(task);
    if (task === 'bolt') {
        const config = customBoltConfig || { boltNum: 24, torqueNum: 3 };
        pendingBoltConfigRef.current = config;
        if (boltConfigTimeoutRef.current) clearTimeout(boltConfigTimeoutRef.current);
        boltConfigTimeoutRef.current = setTimeout(() => {
            if (pendingBoltConfigRef.current) {
                sendCommand('BOLT_CONFIG', pendingBoltConfigRef.current);
                pendingBoltConfigRef.current = null;
            }
        }, 1500);
    } else {
        pendingBoltConfigRef.current = null;
        if (boltConfigTimeoutRef.current) {
            clearTimeout(boltConfigTimeoutRef.current);
            boltConfigTimeoutRef.current = null;
        }
    }

    sendCommand('LOAD_APP', { app_name: TASK_APP_NAMES[task] || task });
    showToast(`Task: ${TASK_NAMES[task] || task}`, 'info');
}, [sendCommand, showToast]);
```

#### 9. `useApp()`
- **Purpose**: Custom React hook that exposes the `AppContext` value to any child component.
- **Throws**: `Error` if called outside of `<AppProvider>`.
- **Code**:
```javascript
export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}
```

---

# 4. Domain Utilities & Hardware Coordinate Mapping

## 4.1 `src/utils/robotModes.js`
- **Path**: [`frontend-react/src/utils/robotModes.js`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/utils/robotModes.js)
- **Role**: Universal Robots standard mode mappings corresponding to UR Primary/Secondary Client Interface sub-package 0 (`ROBOT_MODE_DATA`).

### Constants & Functions:

#### `ROBOT_MODE_NAMES`
Dictionary mapping raw UR integer status codes to canonical mode names:
```javascript
export const ROBOT_MODE_NAMES = {
    '-1': 'NO_CONTROLLER',
    '0': 'DISCONNECTED',
    '1': 'CONFIRM_SAFETY',
    '2': 'BOOTING',
    '3': 'POWER_OFF',
    '4': 'POWER_ON',
    '5': 'IDLE',
    '6': 'BACKDRIVE',
    '7': 'RUNNING',
    '8': 'UPDATING_FIRMWARE',
};
```

#### `formatRobotMode(rawMode)`
- **Purpose**: Normalizes any mode representation (numeric, prefixed string `ROBOT_MODE_RUNNING`, or null) into a clean uppercase string.
- **Parameters**: `rawMode` (`Number|String|null`).
- **Returns**: `String` (e.g. `'RUNNING'`, `'IDLE'`, `'POWER_OFF'`).
- **Code**:
```javascript
export function formatRobotMode(rawMode) {
    if (rawMode === undefined || rawMode === null) return 'POWER_OFF';
    const str = String(rawMode).trim();
    if (ROBOT_MODE_NAMES[str]) {
        return ROBOT_MODE_NAMES[str];
    }
    return str.replace(/^ROBOT_MODE_/i, '').toUpperCase();
}
```

#### `dotColorForMode(mode)`
- **Purpose**: Returns the status indicator color corresponding to the current robot state.
- **Parameters**: `mode` (`String|Number`).
- **Returns**: `'green'`, `'yellow'`, or `'red'`.
- **Code**:
```javascript
export function dotColorForMode(mode) {
    const formatted = formatRobotMode(mode);
    switch (formatted) {
        case 'RUNNING':
            return 'green';
        case 'IDLE':
        case 'POWER_ON':
        case 'BACKDRIVE':
        case 'BOOTING':
        case 'INITIALIZING':
            return 'yellow';
        case 'CONFIRM_SAFETY':
        case 'UPDATING_FIRMWARE':
        case 'POWER_OFF':
        case 'DISCONNECTED':
        case 'NO_CONTROLLER':
            return 'red';
        default:
            return 'yellow';
    }
}
```

---

## 4.2 `src/components/boltPlateLayout.js`
- **Path**: [`frontend-react/src/components/boltPlateLayout.js`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/boltPlateLayout.js)
- **Role**: Mathematical geometry and color maps for the bolting fixture.

### Data Structures:

#### `BOLT_OVERLAY_POSITIONS`
Contains the sub-pixel calibrated `{ x, y }` coordinates of all 24 bolts expressed as percentages (`0.0%` to `100.0%`) relative to the rendered artwork:
```javascript
export const BOLT_OVERLAY_POSITIONS = {
    1: { x: 27.41, y: 88.46 },
    2: { x: 49.63, y: 5.63 },
    3: { x: 71.82, y: 88.45 },
    4: { x: 11.14, y: 27.81 },
    5: { x: 88.04, y: 27.84 },
    6: { x: 11.14, y: 72.22 },
    7: { x: 94.01, y: 50.02 },
    8: { x: 27.42, y: 11.56 },
    9: { x: 49.62, y: 94.40 },
    10: { x: 5.19, y: 50.02 },
    11: { x: 71.82, y: 11.59 },
    12: { x: 88.05, y: 72.20 },
    13: { x: 30.40, y: 69.25 },
    14: { x: 49.64, y: 22.85 },
    15: { x: 68.86, y: 69.25 },
    16: { x: 30.40, y: 30.81 },
    17: { x: 68.86, y: 30.82 },
    18: { x: 49.63, y: 77.21 },
    19: { x: 22.42, y: 50.02 },
    20: { x: 76.80, y: 50.02 },
    21: { x: 49.64, y: 61.23 },
    22: { x: 49.64, y: 38.81 },
    23: { x: 38.41, y: 50.01 },
    24: { x: 60.85, y: 50.03 },
};
```

#### `BOLT_TORQUE_COLORS`
Defines the real robot torque pass progression colors matching `ws_server.py`:
```javascript
export const BOLT_TORQUE_COLORS = {
    lawngreen: '#7cfc00', // Pass 4-5 (Complete)
    yellow: '#eab308',    // Pass 3
    orange: '#f97316',    // Pass 2
    red: '#ef4444',       // Pass 1
    indigo: '#6366f1',    // Pass 0
    white: '#ffffff',     // Untightened
};
```

#### `BOLT_PASS_LEGEND`
Array used to render the color legend below the plate:
```javascript
export const BOLT_PASS_LEGEND = [
    { color: '#7cfc00', label: 'Pass 4–5' },
    { color: '#eab308', label: 'Pass 3' },
    { color: '#f97316', label: 'Pass 2' },
    { color: '#ef4444', label: 'Pass 1' },
    { color: '#6366f1', label: 'Pass 0' },
    { color: '#ffffff', label: 'Pending' },
];
```

---

# 5. UI Components

## 5.1 `src/components/Header.jsx`
- **Path**: [`frontend-react/src/components/Header.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/Header.jsx)
- **Role**: Top application bar with logo navigation and TCP socket status indicator.
- **Functions**:
  - `Header()`: Renders the header. Uses `useNavigate()` to return home when clicking the logo, and reads `tcpConnected` from `AppContext` to display a live green or red indicator dot:
    ```jsx
    <div className="connection-indicator" title="TCP Connection Status">
        <span className={`dot ${tcpConnected ? 'connected' : 'disconnected'}`}></span>
    </div>
    ```

---

## 5.2 `src/components/TabBar.jsx`
- **Path**: [`frontend-react/src/components/TabBar.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/TabBar.jsx)
- **Role**: Persistent bottom navigation bar for switching between views within the active task.
- **Constants**:
  - `TABS = [{ path: '', label: 'Main' }, { path: 'vision', label: 'Vision' }, { path: 'logs', label: 'Logs' }, { path: 'calibrate', label: 'Calibrate' }, { path: 'advanced', label: 'Advanced' }]`
- **Functions**:
  - `TabBar()`: Uses `useParams()` to read the active `/:task` segment. Renders `<NavLink>` elements with active class highlighting based on current URL.

---

## 5.3 `src/components/StatusList.jsx`
- **Path**: [`frontend-react/src/components/StatusList.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/StatusList.jsx)
- **Role**: Renders the 5 primary status telemetry fields on the Main Panel.
- **Functions**:
  - `dotColorForCommand(currentCommand)`: Returns `'green'` if command is active, or `'yellow'` if idle.
  - `StatusList({ status, connected })`: Formats and displays:
    1. **Connected**: Green dot if `connected` is true, else red.
    2. **Current Command**: Action name with dot from `dotColorForCommand`.
    3. **Robot Mode**: Normalized string via `formatRobotMode` and colored via `dotColorForMode`.
    4. **Program Running**: Boolean state with green/yellow dot.
    5. **Safety Status**: Safety state string (`NORMAL` = yellow dot, non-normal = red dot).

---

## 5.4 `src/components/BoltPlateVisual.jsx`
- **Path**: [`frontend-react/src/components/BoltPlateVisual.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/BoltPlateVisual.jsx)
- **Role**: Interactive visualizer for top plate bolting. Displays the plate PNG, overlays status markers at exact percentage coordinates, and pulses the active bolt.

### Functions in `BoltPlateVisual`:

#### 1. `resolveBoltColor(colorName)`
- **Purpose**: Normalizes color strings from WebSocket into hex color codes.
- **Parameters**: `colorName` (`String`).
- **Returns**: Hex code (e.g. `'#7cfc00'`) or the raw string.
- **Code**:
```javascript
function resolveBoltColor(colorName) {
    if (!colorName) return null;
    const lower = String(colorName).trim().toLowerCase();
    return BOLT_TORQUE_COLORS[lower] || colorName;
}
```

#### 2. `markerColor(bolt, active)`
- **Purpose**: Calculates the rendered color of a bolt marker based on its torque status and whether it is actively being torqued.
- **Parameters**:
  - `bolt` (`Object|String|null`): Data from `bolt_positions[id]`.
  - `active` (`Boolean`): True if the robot is currently driving this bolt.
- **Returns**: Hex color string or `null` if hidden.
- **Code**:
```javascript
function markerColor(bolt, active) {
    if (!bolt) return active ? IN_PROGRESS_FALLBACK : null;

    // 1. Direct color from get_bolt_torque (e.g. "lawngreen", "yellow", "orange", "red", "indigo", "white")
    const rawColor = typeof bolt === 'string' ? bolt : (bolt.color || null);
    if (rawColor) {
        const lower = rawColor.toLowerCase();
        // Completed passes display their achieved torque color immediately
        if (lower !== 'white') {
            return resolveBoltColor(rawColor);
        }
        // Untorqued ("white") bolt pulses amber-yellow while the robot is driving it
        if (active) return IN_PROGRESS_FALLBACK;
        return null;
    }

    // 2. Legacy fallback
    const torqueVal = bolt.torque ?? bolt.torque_id;
    const torqueColor = TORQUE_COLORS[torqueVal] || null;
    if (bolt.status === 'complete') return torqueColor || '#22c55e';
    if (bolt.status === 'in_progress' || active) return torqueColor || IN_PROGRESS_FALLBACK;
    return null;
}
```

#### 3. `BoltPlateVisual({ boltPositions, activeBolt, bolting })`
- **Purpose**: Main component. Computes `activeId` by checking `activeBolt` reported by the controller, renders the plate image, maps over `BOLT_OVERLAY_POSITIONS`, and renders markers with glowing rings.

---

## 5.5 `src/components/BoltPlateCanvas.jsx`
- **Path**: [`frontend-react/src/components/BoltPlateCanvas.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/BoltPlateCanvas.jsx)
- **Role**: Alternative canvas renderer capable of drawing concentric circular bolt arrangements (40 bolts across 3 concentric rings) using the HTML5 2D Context API.
- **Functions**:
  - `draw(canvas, boltPositions)`: Clears canvas, renders base concentric circles, calculates polar coordinates for 40 bolts, draws colored arcs based on torque, and prints joint labels (`J1` to `J14`).
  - `BoltPlateCanvas({ boltPositions })`: Binds canvas reference and triggers `draw` on every update via `useEffect`.

---

## 5.6 `src/components/RobotMovePad.jsx`
- **Path**: [`frontend-react/src/components/RobotMovePad.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/RobotMovePad.jsx)
- **Role**: Cartesian manual jog controller for testing and calibration.

### Functions in `RobotMovePad`:

#### 1. `move(action, direction)`
- **Purpose**: Dispatches a `MOVE_X` or `MOVE_Y` command multiplied by the current step size slider value.
- **Parameters**:
  - `action` (`String`): `'MOVE_X'` or `'MOVE_Y'`.
  - `direction` (`Number`): `1` (positive) or `-1` (negative).
- **Code**:
```javascript
const move = (action, direction) => {
    const value = direction * stepSizeRef.current;
    sendCommand(action, { value });
};
```

#### 2. `handleKeyDown(e)` (`useEffect`)
- **Purpose**: Binds arrow keys and WASD keys to Cartesian jogging. Prevents repeat key spam via `!e.repeat` and applies brief visual button-press states:
```javascript
switch (e.key) {
    case 'ArrowUp':
    case 'w': case 'W':
        action = 'MOVE_Y'; direction = 1; break;
    case 'ArrowDown':
    case 's': case 'S':
        action = 'MOVE_Y'; direction = -1; break;
    case 'ArrowLeft':
    case 'a': case 'A':
        action = 'MOVE_X'; direction = -1; break;
    case 'ArrowRight':
    case 'd': case 'D':
        action = 'MOVE_X'; direction = 1; break;
    default:
        return;
}
```

---

## 5.7 `src/components/ProcessSteps.jsx`
- **Path**: [`frontend-react/src/components/ProcessSteps.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/ProcessSteps.jsx)
- **Role**: Renders an ordered checklist of process stages. Shows `✓` for `complete` steps, `●` for `in_progress`, and blank circles for `pending`.

---

## 5.8 `src/components/ProgressBar.jsx`
- **Path**: [`frontend-react/src/components/ProgressBar.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/ProgressBar.jsx)
- **Role**: Reusable progress bar component with percentage clamping between `0%` and `100%`.

---

## 5.9 `src/components/ProgressDonut.jsx`
- **Path**: [`frontend-react/src/components/ProgressDonut.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/ProgressDonut.jsx)
- **Role**: Visualizer for the Gel Installation task. Calculates degrees for Outer Gels, Inner Gels, and Backers to render a multi-color `conic-gradient` circular donut chart.

---

## 5.10 `src/components/TaskLayout.jsx`
- **Path**: [`frontend-react/src/components/TaskLayout.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/TaskLayout.jsx)
- **Role**: Structural layout wrapper for all routes under `/:task`.
- **Functions**:
  - `TaskLayout()`: Validates `task` against `VALID_TASKS = ['bolt', 'clean', 'gel']`. If invalid, redirects to `/`. Synchronizes `currentTask` state if accessed directly via URL, and renders `<Header />`, `<Outlet />`, `<TabBar />`, and `<ToastContainer withNavbar />`.

---

## 5.11 `src/components/ToastContainer.jsx`
- **Path**: [`frontend-react/src/components/ToastContainer.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/components/ToastContainer.jsx)
- **Role**: Fixed-position notification stack that renders toasts created via `showToast()`.

---

# 6. Pages & Application Views

## 6.1 `src/pages/HomePage.jsx`
- **Path**: [`frontend-react/src/pages/HomePage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/HomePage.jsx)
- **Role**: Landing screen displaying task cards to launch automated recipes.
- **Functions**:
  - `handleSelect(taskId)`: Invokes `selectTask(taskId)` to initiate the `load_app` + `bolt_config` sequence and navigates to `/${taskId}`.

---

## 6.2 `src/pages/MainPanelPage.jsx`
- **Path**: [`frontend-react/src/pages/MainPanelPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/MainPanelPage.jsx)
- **Role**: Primary operating view. Houses robot control buttons, status telemetry, and the live task visualizer.

### Control Button Interlock State Logic
```javascript
const isInitialized = !!robotStatus.initialized;
const programRunning = !!robotStatus.program_running;
const initializing = robotStatus.robot_mode === 'INITIALIZING';

// 1. Initialize: Enabled only when uninitialized, not initializing, and not running
const isInitializeDisabled = isInitialized || initializing || programRunning;

// 2. Start: Enabled only when initialized and not running
const isStartDisabled = !isInitialized || programRunning;

// 3. Stow: Enabled when initialized or running
const isStowDisabled = !isInitialized && !programRunning;
```

---

## 6.3 `src/pages/VisionPage.jsx`
- **Path**: [`frontend-react/src/pages/VisionPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/VisionPage.jsx)
- **Role**: Live machine vision feed with reticles, grid overlays, snapshot export, and full-screen inspection.

### Functions in `VisionPage`:

#### 1. `processFrame(data)`
- **Purpose**: Converts incoming binary byte arrays (`Uint8Array`) or Base64 payloads into renderable Object URLs.
- **Memory Management**: Automatically revokes the previous `blob:` URL via `URL.revokeObjectURL` to prevent browser memory leaks during high-frequency video streaming:
```javascript
const processFrame = useCallback((data) => {
    if (!data) return;

    let newUrl = null;
    if (Array.isArray(data) || data instanceof Uint8Array) {
        const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
        if (u8.length < 4) return;

        // Sniff PNG (137, 80) or JPEG (255, 216) magic bytes
        const isPng = u8[0] === 137 && u8[1] === 80;
        const mime = isPng ? 'image/png' : 'image/jpeg';

        const blob = new Blob([u8], { type: mime });
        newUrl = URL.createObjectURL(blob);
    } else if (typeof data === 'string') {
        newUrl = data.startsWith('data:') ? data : `data:image/png;base64,${data}`;
    }

    if (newUrl) {
        if (prevUrlRef.current && prevUrlRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(prevUrlRef.current);
        }
        prevUrlRef.current = newUrl;
        setFrameSrc(newUrl);
        setIsLive(true);
        setFrameCount((prev) => prev + 1);

        // Calculate rolling FPS over a 1000ms window
        const now = performance.now();
        frameTimesRef.current.push(now);
        while (frameTimesRef.current.length > 0 && frameTimesRef.current[0] < now - 1000) {
            frameTimesRef.current.shift();
        }
        setFps(frameTimesRef.current.length);

        // Reset signal watchdog (2500ms timeout)
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
            setIsLive(false);
            setFps(0);
        }, 2500);
    }
}, []);
```

#### 2. `handleSnapshot()`
- **Purpose**: Saves the currently displayed frame to disk as a timestamped PNG file.

#### 3. `handleFullscreen()`
- **Purpose**: Requests full-screen display on the camera container element.

---

## 6.4 `src/pages/CalibratePage.jsx`
- **Path**: [`frontend-react/src/pages/CalibratePage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/CalibratePage.jsx)
- **Role**: Calibration screen for robot tools and sensors.
- **Controls**:
  - Sub-tabs: `Laser`, `Camera`, `Bolt`, `Clean`, `Gel`.
  - Position 1 & 2: Dispatches `GO_CALIBRATION` and `SET_CALIBRATION`.
  - Laser TCP: Dispatches `UPDATE_LASER_TCP`.
  - Measure: Dispatches `READ_LASER` and displays live measurement value and unit.
  - Embedded `RobotMovePad` for fine manual positioning.

---

## 6.5 `src/pages/AdvancedPage.jsx`
- **Path**: [`frontend-react/src/pages/AdvancedPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/AdvancedPage.jsx)
- **Role**: Engineering diagnostics console.
- **Functions**:
  - `handleConnect()`: Validates IP and port, then dispatches `CONNECT`.
  - `handleDisconnect()`: Dispatches `DISCONNECT`.
  - `handleSend()`: Parses JSON parameters from input and dispatches raw commands to the controller with immediate terminal echoing.

---

## 6.6 `src/pages/LogsPage.jsx`
- **Path**: [`frontend-react/src/pages/LogsPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/LogsPage.jsx)
- **Role**: Diagnostic log viewer with filtering, auto-scroll, and file export.
- **Functions**:
  - `exportLogs()`: Formats log items into standard timestamped text and triggers an automatic browser download (`cobot_logs_<timestamp>.txt`).

---

## 6.7 `src/pages/DataPage.jsx`
- **Path**: [`frontend-react/src/pages/DataPage.jsx`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/pages/DataPage.jsx)
- **Role**: Placeholder view for future MES/SCADA production analytics.

---

# 7. Design System & CSS Styling

## 7.1 `src/styles/tokens.css`
- **Path**: [`frontend-react/src/styles/tokens.css`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/styles/tokens.css)
- **Role**: Central design system token definitions.
- **Token Highlights**:
  - Surface colors: `--bg-primary: #0a0e1a`, `--bg-secondary: #121829`, `--bg-card: #18213d`.
  - Brand accents: `--blue: #3b82f6`, `--teal: #14cfc0`.
  - Status indicators: `--green: #22c55e`, `--yellow: #eab308`, `--red: #ef4444`.
  - Typography: `--font-family: 'Inter', sans-serif`.

---

## 7.2 `src/styles/base.css`
- **Path**: [`frontend-react/src/styles/base.css`](file:///home/adi/Desktop/GUIRev2/frontend-react/src/styles/base.css)
- **Role**: Global CSS reset, base layout rules, button classes (`.hmi-btn`, `.ctrl-btn`), card styling, and custom scrollbar rules.

---

# 8. Production Static Server

## 8.1 `serve.py`
- **Path**: [`frontend-react/serve.py`](file:///home/adi/Desktop/GUIRev2/frontend-react/serve.py)
- **Role**: Standalone Python HTTP server built specifically to serve the production bundle in `dist/`.
- **Key Classes & Functions**:
  - `find_dist_dir()`: Automatically locates the compiled `dist/` folder regardless of the current working directory.
  - `QuietSPAServer.do_GET()`: Implements SPA URL rewriting so deep links (e.g. `/bolt/vision`) return `/index.html` instead of 404 errors.
  - `QuietSPAServer.end_headers()`: Attaches `Cache-Control: no-cache, no-store, must-revalidate` to HTML requests to prevent stale asset caching.
  - `ReusableTCPServer`: Suppresses `BrokenPipeError` caused by abrupt browser tab closures or reloads.
