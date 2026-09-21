import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatRobotMode } from '../utils/robotModes';

const AppContext = createContext(null);

const TASK_NAMES = { bolt: 'Top Plate Bolting', clean: 'Chamber Cleaning', gel: 'Gel Installation' };
const TASK_APP_NAMES = { bolt: 'TopPlateBolt', clean: 'ChamberClean', gel: 'GelInstall' };

/**
 * Maps command_received data codes (strings) to command identities.
 * e.g. data:"1" means "initialize acknowledged", data:"2" means "start acknowledged".
 */
const RESPONSE_CODE_MAP = {
    "0": 'release_brakes',
    "1": 'initialize',
    "2": 'start',
    "3": 'pause',
    "4": 'abort',
    "5": 'stow',
    "6": 'turn_robot_off',
    "7": 'turn_robot_on',
};

let toastId = 0;

export function AppProvider({ children }) {
    const [robotStatus, setRobotStatus] = useState({});
    const [tcpConnected, setTcpConnected] = useState(false);
    const [logs, setLogs] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [laserReading, setLaserReading] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);
    const [cdaPopup, setCdaPopup] = useState(false);
    const [consoleLines, setConsoleLines] = useState([
        { text: 'System ready. Type a command or use the buttons above.', type: 'system' },
    ]);
    const consoleIdRef = useRef(0);
    const pendingBoltConfigRef = useRef(null);
    const boltConfigTimeoutRef = useRef(null);
    const sendCommandRef = useRef(null);
    const cameraListenersRef = useRef(new Set());
    const latestCameraFrameRef = useRef(null);
    const [isBoltingPolling, setIsBoltingPolling] = useState(false);
    const hasBoltingRunStartedRef = useRef(false);
    const isRunActiveRef = useRef(false);
    const postRunTimerRef = useRef(null);
    const pendingBoltTorqueResolverRef = useRef(null);

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

    const showToast = useCallback((message, type = 'info') => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const addConsoleLine = useCallback((text, type = 'system') => {
        consoleIdRef.current += 1;
        setConsoleLines((prev) => [...prev, { id: consoleIdRef.current, text, type }]);
    }, []);

    const handleMessage = useCallback((message) => {
        switch (message.type) {
            case 'update_state':
            case 'status_update':
                setRobotStatus((prev) => {
                    const incoming = message.data || {};
                    const rawRobotMode = incoming.robotMode ?? incoming.robot_mode ?? prev.robot_mode ?? 'IDLE';
                    const robotMode = formatRobotMode(rawRobotMode);
                    const programRunning = incoming.programIsRunning ?? incoming.program_running ?? prev.program_running ?? false;
                    const safetyStatus = incoming.safetyStatus ?? incoming.safety_status ?? prev.safety_status ?? 'NORMAL';
                    const currentCommand = incoming.currentCommand ?? incoming.current_command ?? prev.current_command ?? 'NO COMMAND';

                    const isPowerOff = robotMode === 'POWER_OFF' || robotMode === 'NO_CONTROLLER' || robotMode === 'DISCONNECTED' || incoming.connected === false;
                    const initialized = isPowerOff ? false : (prev.initialized || incoming.initialized || false);

                    // Preserve existing bolt colors when update_state arrives (only if Start has been clicked in this cycle)
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

                    return {
                        ...prev,
                        ...incoming,
                        robot_mode: robotMode,
                        robotMode,
                        program_running: programRunning,
                        programIsRunning: programRunning,
                        safety_status: safetyStatus,
                        safetyStatus,
                        current_command: currentCommand,
                        currentCommand,
                        initialized,
                        bolt_positions: mergedBolts,
                    };
                });
                break;
            case 'connection': {
                const connected = message.data?.tcp_connected;
                setTcpConnected(!!connected);
                const msg = connected ? 'Connected to backend & robot' : 'Disconnected from robot';
                if (connected) showToast(msg, 'success');
                break;
            }
            case 'command_received': {
                // Handle string ("1"), number (1), or wrapped object ({"code": "1"})
                let rawCode = message.data;
                let messageText = '';
                if (typeof rawCode === 'object' && rawCode !== null) {
                    messageText = rawCode.message || '';
                    rawCode = rawCode.code ?? rawCode.data ?? rawCode.status ?? '';
                }
                const dataCode = String(rawCode ?? '').trim();
                let commandName = RESPONSE_CODE_MAP[dataCode];
                if (!commandName) {
                    if (messageText.toLowerCase().includes('calibrat')) {
                        commandName = 'calibration';
                    } else if (messageText.toLowerCase().includes('bolt')) {
                        commandName = 'bolt_config';
                    } else if (messageText.toLowerCase().includes('connect')) {
                        commandName = 'connect';
                    } else if (dataCode.toLowerCase() === 'ok') {
                        commandName = 'ack';
                    } else {
                        commandName = `ack(${dataCode})`;
                    }
                }

                // Any command_received means the backend is alive, unless disconnecting
                if (commandName === 'disconnect' || message.data?.connected === false) {
                    setTcpConnected(false);
                } else {
                    setTcpConnected(true);
                }

                // Console + toast
                addConsoleLine(`← command_received [${commandName}] data: ${dataCode}`, 'received');
                if (commandName === 'calibration') {
                    // Calibration replies carry their own message and may report failure
                    const failed = dataCode.toLowerCase() === 'error';
                    showToast(messageText || 'Calibration acknowledged', failed ? 'error' : 'success');
                } else if (commandName !== 'ack') {
                    showToast(`${commandName} acknowledged (${dataCode})`, 'success');
                }

                // Update robotStatus based on which command was acknowledged
                switch (commandName) {
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
                    case 'release_brakes':
                        setRobotStatus(prev => ({ ...prev, brakes_released: true }));
                        break;
                    case 'turn_robot_on':
                        setRobotStatus(prev => ({ ...prev, robot_on: true, robot_mode: 'IDLE' }));
                        break;
                    case 'turn_robot_off':
                        hasBoltingRunStartedRef.current = false;
                        setRobotStatus(prev => ({
                            ...prev,
                            robot_on: false,
                            initialized: false,
                            robot_mode: 'POWER_OFF',
                            program_running: false,
                            active_bolt: null,
                            process_progress: 0,
                            bolt_positions: {},
                            bolt_torque_colors: [],
                        }));
                        break;
                    case 'start':
                        hasBoltingRunStartedRef.current = true;
                        setRobotStatus(prev => ({ ...prev, program_running: true }));
                        break;
                    case 'pause':
                        setRobotStatus(prev => ({ ...prev, program_running: false }));
                        break;
                    case 'abort':
                        hasBoltingRunStartedRef.current = false;
                        setRobotStatus(prev => ({
                            ...prev,
                            program_running: false,
                            active_bolt: null,
                            process_progress: 0,
                            bolt_positions: {},
                            bolt_torque_colors: [],
                        }));
                        break;
                    case 'stow':
                        hasBoltingRunStartedRef.current = false;
                        setRobotStatus(prev => ({
                            ...prev,
                            initialized: false,
                            robot_mode: 'POWER_OFF',
                            program_running: false,
                            active_bolt: null,
                            process_progress: 0,
                            bolt_positions: {},
                            bolt_torque_colors: [],
                        }));
                        break;
                    case 'disconnect':
                        hasBoltingRunStartedRef.current = false;
                        setTcpConnected(false);
                        setRobotStatus(prev => ({
                            ...prev,
                            initialized: false,
                            robot_mode: 'POWER_OFF',
                            program_running: false,
                            active_bolt: null,
                            process_progress: 0,
                            bolt_positions: {},
                            bolt_torque_colors: [],
                        }));
                        break;
                    default:
                        break;
                }

                // Handle laser reading (if response contains value/unit)
                if (typeof message.data === 'object' && message.data?.value !== undefined && message.data?.unit) {
                    setLaserReading(message.data);
                }

                console.log('[WS-RECV]', JSON.stringify(message));

                // Log raw JSON to Logs tab
                setLogs((prev) => {
                    const next = [...prev, {
                        timestamp: Date.now() / 1000,
                        level: 'INFO',
                        source: 'server',
                        message: JSON.stringify(message),
                    }];
                    return next.length > 1000 ? next.slice(next.length - 1000) : next;
                });
                break;
            }
            case 'load_app': {
                const appName = message.data?.app_name || '';
                const appData = message.data?.app_data;
                const msgText = typeof appData === 'string' ? appData : JSON.stringify(appData || '');
                if (appName) {
                    addConsoleLine(`← load_app: ${appName} (${msgText})`, 'received');
                    showToast(`Loaded ${appName}`, 'success');
                }
                console.log('[WS-RECV]', JSON.stringify(message));
                setLogs((prev) => {
                    const next = [...prev, {
                        timestamp: Date.now() / 1000,
                        level: 'INFO',
                        source: 'server',
                        message: JSON.stringify(message),
                    }];
                    return next.length > 1000 ? next.slice(next.length - 1000) : next;
                });

                // Clear any fallback timeout
                if (boltConfigTimeoutRef.current) {
                    clearTimeout(boltConfigTimeoutRef.current);
                    boltConfigTimeoutRef.current = null;
                }

                // Step 2 -> Step 3: Following load_app response, dispatch bolt_config
                if (pendingBoltConfigRef.current) {
                    const configToSend = pendingBoltConfigRef.current;
                    pendingBoltConfigRef.current = null;
                    console.log('[WS] load_app response acknowledged. Sending bolt_config:', configToSend);
                    sendCommandRef.current?.('BOLT_CONFIG', configToSend);
                }
                break;
            }
            case 'log':
                setLogs((prev) => {
                    const next = [...prev, message.data];
                    return next.length > 1000 ? next.slice(next.length - 1000) : next;
                });
                break;
            case 'log_history':
                setLogs(message.data || []);
                break;
            case 'cda_popup': {
                const isPopupActive = Boolean(message.data);
                setCdaPopup(isPopupActive);
                setRobotStatus((prev) => ({
                    ...prev,
                    cda_popup: isPopupActive,
                    cdaPopup: isPopupActive,
                    cda_status: isPopupActive,
                    cdaStatus: isPopupActive,
                }));
                console.log('[WS-RECV] CDA Popup:', isPopupActive);
                addConsoleLine(`← cda_popup: ${isPopupActive}`, isPopupActive ? 'warning' : 'received');
                if (isPopupActive) {
                    showToast('CDA Status Active', 'warning');
                }
                setLogs((prev) => {
                    const next = [...prev, {
                        timestamp: Date.now() / 1000,
                        level: isPopupActive ? 'WARN' : 'INFO',
                        source: 'server',
                        message: JSON.stringify(message),
                    }];
                    return next.length > 1000 ? next.slice(next.length - 1000) : next;
                });
                break;
            }
            case 'get_bolt_torque':
            case 'get_bolt_status': {
                const rawColors = message.data;
                if (Array.isArray(rawColors)) {
                    console.log(`[WS-RECV] ${message.type} (total ${rawColors.length} items): bolt23='${rawColors[22]}', bolt24='${rawColors[23]}', bolt25='${rawColors[24]}'`);
                } else {
                    console.log(`[WS-RECV] ${message.type}:`, rawColors);
                }

                // Notify pending async request that response has arrived
                if (pendingBoltTorqueResolverRef.current) {
                    const resolver = pendingBoltTorqueResolverRef.current;
                    pendingBoltTorqueResolverRef.current = null;
                    resolver(rawColors);
                }

                // Only color the bolt plate AFTER the Start button has been clicked for the current cycle
                if (!hasBoltingRunStartedRef.current) {
                    console.log('[WS] Ignoring get_bolt_torque coloring: bolting run has not been started yet.');
                    setRobotStatus((prev) => {
                        if (prev.program_running) {
                            // If program is running, treat as started
                            hasBoltingRunStartedRef.current = true;
                        } else {
                            return {
                                ...prev,
                                bolt_positions: {},
                                bolt_torque_colors: [],
                                active_bolt: null,
                            };
                        }
                        return prev;
                    });
                    if (!hasBoltingRunStartedRef.current) {
                        break;
                    }
                }

                setRobotStatus((prev) => {
                    const existingBolts = { ...(prev.bolt_positions || {}) };
                    if (Array.isArray(rawColors)) {
                        rawColors.forEach((col, idx) => {
                            const boltId = idx + 1; // 1-indexed bolts 1..24
                            existingBolts[boltId] = {
                                ...(existingBolts[boltId] || {}),
                                color: col,
                                status: (col && col.toLowerCase() !== 'white') ? 'complete' : 'pending',
                            };
                        });
                    } else if (typeof rawColors === 'object' && rawColors !== null) {
                        Object.entries(rawColors).forEach(([id, val]) => {
                            const col = typeof val === 'object' ? (val.color || val.status) : String(val);
                            existingBolts[id] = {
                                ...(existingBolts[id] || {}),
                                color: col,
                                status: (col && col.toLowerCase() !== 'white') ? 'complete' : 'pending',
                            };
                        });
                    }

                    return {
                        ...prev,
                        bolt_positions: existingBolts,
                        bolt_torque_colors: rawColors,
                    };
                });
                break;
            }
            case 'camera_frame': {
                latestCameraFrameRef.current = message.data;
                cameraListenersRef.current.forEach((cb) => {
                    try {
                        cb(message.data);
                    } catch (e) {
                        console.error('[Vision] Camera frame listener error:', e);
                    }
                });
                break;
            }
            case 'error':
                showToast(message.data?.message || 'Server error', 'error');
                setLogs((prev) => {
                    const next = [...prev, {
                        timestamp: Date.now() / 1000,
                        level: 'ERROR',
                        source: 'server',
                        message: JSON.stringify(message),
                    }];
                    return next.length > 1000 ? next.slice(next.length - 1000) : next;
                });
                break;
            default:
                break;
        }
    }, [showToast, addConsoleLine]);

    const { connected: wsConnected, sendCommand: rawSendCommand } = useWebSocket(handleMessage);

    // If browser loses WebSocket connection to the server, the dot must turn RED
    useEffect(() => {
        if (!wsConnected) {
            setTcpConnected(false);
        }
    }, [wsConnected]);

    // Wraps rawSendCommand to add logging of the exact sent JSON
    const sendCommand = useCallback((action, params = {}) => {
        const actionStr = String(action || '');
        const upper = actionStr.toUpperCase();
        const msg = { type: actionStr.toLowerCase() };
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
        console.log('[WS-SEND]', rawSent);

        // Control get_bolt_torque polling state based on action
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

        // Immediately reset visualizer and state on Initialize or Stow click
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

        // Log exact raw sent JSON to Logs tab (skip get_bolt_torque / get_bolt_status polling spam)
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
    sendCommandRef.current = sendCommand;

    // Automatic start & stop of 0.5s get_bolt_torque polling with a 6-second post-run window
    useEffect(() => {
        if (robotStatus.program_running) {
            isRunActiveRef.current = true;
            hasBoltingRunStartedRef.current = true;
            if (postRunTimerRef.current) {
                clearTimeout(postRunTimerRef.current);
                postRunTimerRef.current = null;
            }
            setIsBoltingPolling(true);
        } else if (isRunActiveRef.current && !robotStatus.program_running) {
            // Bolting process finished — robot arm stopped moving
            console.log('[WS] Robot bolting sequence finished. Starting 6-second post-run polling window for bolt 24...');
            isRunActiveRef.current = false;

            // Clear any existing post-run timer
            if (postRunTimerRef.current) {
                clearTimeout(postRunTimerRef.current);
            }

            // Keep isBoltingPolling active for 6 seconds so the 0.5s polling loop continues,
            // giving the controller/screwdriver driver time to write the final 24th bolt color.
            postRunTimerRef.current = setTimeout(() => {
                console.log('[WS] 6-second post-run polling window ended. Stopping get_bolt_torque polling.');
                setIsBoltingPolling(false);
                postRunTimerRef.current = null;
            }, 6000);
        }
    }, [robotStatus.program_running]);

    // Asynchronously sends get_bolt_torque and non-blockingly awaits the response
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

    // Asynchronous Request-Response loop for get_bolt_torque while process is running:
    // Sends the command asynchronously, waits for the response without blocking anything,
    // updates the UI, and only when it receives the response does it send again after a 0.5s pause.
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
            console.log('[WS] Starting sequential async get_bolt_torque polling loop...');

            while (!isCancelled && isBoltingPolling && wsConnected) {
                try {
                    // Send command and asynchronously await response (non-blocking)
                    await requestBoltTorqueAsync(5000);

                    if (isCancelled || !isBoltingPolling || !wsConnected) break;

                    // Pacing delay: wait 0.5s after response arrives before sending next command
                    await new Promise((resolve) => setTimeout(resolve, 500));
                } catch (err) {
                    console.error('[WS] get_bolt_torque polling loop error:', err);
                    break;
                }
            }

            console.log('[WS] Sequential get_bolt_torque loop terminated.');
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

    const selectTask = useCallback((task, customBoltConfig = null) => {
        setCurrentTask(task);
        hasBoltingRunStartedRef.current = false;
        setRobotStatus((prev) => ({
            ...prev,
            bolt_positions: {},
            bolt_torque_colors: [],
            active_bolt: null,
            process_progress: 0,
        }));
        if (task === 'bolt') {
            const config = customBoltConfig || { boltNum: 24, torqueNum: 3 };
            pendingBoltConfigRef.current = config;
            if (boltConfigTimeoutRef.current) clearTimeout(boltConfigTimeoutRef.current);
            // Safety fallback: if load_app response is not received within 1500ms, send bolt_config
            boltConfigTimeoutRef.current = setTimeout(() => {
                if (pendingBoltConfigRef.current) {
                    console.log('[WS] Safety fallback: sending bolt_config without load_app ack');
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

    const value = useMemo(() => ({
        robotStatus,
        tcpConnected,
        wsConnected,
        logs,
        setLogs,
        toasts,
        showToast,
        laserReading,
        currentTask,
        setCurrentTask,
        selectTask,
        sendCommand,
        consoleLines,
        addConsoleLine,
        cdaPopup,
        setCdaPopup,
        onCameraFrame,
        taskNames: TASK_NAMES,
    }), [robotStatus, tcpConnected, wsConnected, logs, toasts, showToast, laserReading, currentTask, selectTask, sendCommand, consoleLines, addConsoleLine, cdaPopup, onCameraFrame]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}
