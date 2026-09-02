import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const AppContext = createContext(null);

const TASK_NAMES = { bolt: 'Top Plate Bolting', clean: 'Chamber Cleaning', gel: 'Gel Installation' };
const TASK_APP_NAMES = { bolt: 'TopPlateBolt', clean: 'ChamberClean', gel: 'GelInstall' };

/**
 * Maps command_received data codes (strings) to command identities.
 * e.g. data:"1" means "initialize acknowledged", data:"2" means "start acknowledged".
 */
const RESPONSE_CODE_MAP = {
    '0': 'release_brakes',
    '1': 'initialize',
    '2': 'start',
    '3': 'pause',
    '4': 'stow',
    '5': 'turn_robot_off',   // also abort — both return "5"
    '6': 'turn_robot_on',
};

let toastId = 0;

export function AppProvider({ children }) {
    const [robotStatus, setRobotStatus] = useState({});
    const [tcpConnected, setTcpConnected] = useState(false);
    const [logs, setLogs] = useState([]);
    const [toasts, setToasts] = useState([]);
    const [laserReading, setLaserReading] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);
    const [consoleLines, setConsoleLines] = useState([
        { text: 'System ready. Type a command or use the buttons above.', type: 'system' },
    ]);
    const consoleIdRef = useRef(0);

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
                setRobotStatus(message.data || {});
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
                if (typeof rawCode === 'object' && rawCode !== null) {
                    rawCode = rawCode.code ?? rawCode.data ?? rawCode.status ?? '';
                }
                const dataCode = String(rawCode ?? '').trim();
                const commandName = RESPONSE_CODE_MAP[dataCode] || (dataCode.toLowerCase() === 'ok' ? 'initialize' : `unknown(${dataCode})`);

                // Any command_received means the backend is alive, unless disconnecting
                if (commandName === 'disconnect' || message.data?.connected === false) {
                    setTcpConnected(false);
                } else {
                    setTcpConnected(true);
                }

                // Console + toast
                addConsoleLine(`← command_received [${commandName}] data: ${dataCode}`, 'received');
                showToast(`${commandName} acknowledged (${dataCode})`, 'success');

                // Update robotStatus based on which command was acknowledged
                switch (commandName) {
                    case 'initialize':
                        setRobotStatus(prev => ({ ...prev, initialized: true, robot_mode: 'IDLE' }));
                        break;
                    case 'release_brakes':
                        setRobotStatus(prev => ({ ...prev, brakes_released: true }));
                        break;
                    case 'turn_robot_on':
                        setRobotStatus(prev => ({ ...prev, robot_on: true, robot_mode: 'IDLE' }));
                        break;
                    case 'turn_robot_off':
                        setRobotStatus(prev => ({ ...prev, robot_on: false, initialized: false, robot_mode: 'POWER_OFF', program_running: false }));
                        break;
                    case 'start':
                        setRobotStatus(prev => ({ ...prev, program_running: true }));
                        break;
                    case 'pause':
                        setRobotStatus(prev => ({ ...prev, program_running: false }));
                        break;
                    case 'stow':
                        setRobotStatus(prev => ({ ...prev, initialized: false, robot_mode: 'POWER_OFF', program_running: false }));
                        break;
                    case 'disconnect':
                        setTcpConnected(false);
                        setRobotStatus(prev => ({ ...prev, initialized: false, robot_mode: 'POWER_OFF', program_running: false }));
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

    // Wraps rawSendCommand to add logging of the exact sent JSON
    const sendCommand = useCallback((action, params = {}) => {
        const msg = { type: action.toLowerCase() };
        if (Object.keys(params).length) {
            msg.data = params;
        }
        const rawSent = JSON.stringify(msg);
        console.log('[WS-SEND]', rawSent);

        // Log exact raw sent JSON to Logs tab
        setLogs((prev) => {
            const next = [...prev, {
                timestamp: Date.now() / 1000,
                level: 'INFO',
                source: 'client',
                message: rawSent,
            }];
            return next.length > 1000 ? next.slice(next.length - 1000) : next;
        });

        rawSendCommand(action, params);
    }, [rawSendCommand]);

    const selectTask = useCallback((task) => {
        setCurrentTask(task);
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
        taskNames: TASK_NAMES,
    }), [robotStatus, tcpConnected, wsConnected, logs, toasts, showToast, laserReading, currentTask, selectTask, sendCommand, consoleLines, addConsoleLine]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}
