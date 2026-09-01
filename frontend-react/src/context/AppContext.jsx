import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const AppContext = createContext(null);

const TASK_NAMES = { bolt: 'Top Plate Bolting', clean: 'Chamber Cleaning', gel: 'Gel Installation' };
const TASK_APP_NAMES = { bolt: 'TopPlateBolt', clean: 'ChamberClean', gel: 'GelInstall' };

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
    const boltCounterRef = useRef(0);
    const pendingCommandsRef = useRef([]);

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
                const data = message.data;
                const commandName = pendingCommandsRef.current.shift();

                if (data) {
                    const msg = data.message || JSON.stringify(data);
                    addConsoleLine(`← ${msg}`, data.status === 'ok' ? 'received' : 'error');
                }
                if (data?.status === 'error') {
                    showToast(data.message, 'error');
                } else if (data?.message) {
                    showToast(data.message, data?.status === 'ok' ? 'success' : 'warning');
                }

                // Update robotStatus based on which command succeeded
                if (data?.status === 'ok') {
                    setTcpConnected(true);
                    switch (commandName) {
                        case 'initialize':
                            setRobotStatus(prev => ({ ...prev, initialized: true, robot_mode: 'IDLE' }));
                            break;
                        case 'stow':
                            setRobotStatus(prev => ({ ...prev, initialized: false, robot_mode: 'POWER_OFF', program_running: false }));
                            break;
                        case 'start':
                            setRobotStatus(prev => ({ ...prev, program_running: true }));
                            break;
                        case 'connect':
                            setTcpConnected(true);
                            break;
                        case 'disconnect':
                            setTcpConnected(false);
                            break;
                        default:
                            break;
                    }
                }

                // Handle laser reading
                if (data?.value !== undefined && data?.unit) {
                    setLaserReading(data);
                }

                console.log('[WS-RECV]', JSON.stringify(message));

                // Display exact raw JSON received from server in Logs
                setLogs((prev) => {
                    const next = [...prev, {
                        timestamp: Date.now() / 1000,
                        level: data?.status === 'error' ? 'ERROR' : 'INFO',
                        source: 'server',
                        message: JSON.stringify(message),
                    }];
                    return next.length > 1000 ? next.slice(next.length - 1000) : next;
                });
                break;
            }
            case 'load_app': {
                console.log('[WS-RECV]', JSON.stringify(message));
                // Display exact raw JSON received from server in Logs
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

    const sendCommand = useCallback((action, params = {}) => {
        const msg = { type: action.toLowerCase() };
        if (Object.keys(params).length) {
            msg.data = params;
        }
        const rawSent = JSON.stringify(msg);
        console.log('[WS-SEND]', rawSent);

        // Log exact raw sent JSON
        setLogs((prev) => {
            const next = [...prev, {
                timestamp: Date.now() / 1000,
                level: 'INFO',
                source: 'client',
                message: rawSent,
            }];
            return next.length > 1000 ? next.slice(next.length - 1000) : next;
        });

        pendingCommandsRef.current.push(action.toLowerCase());
        return rawSendCommand(action, params);
    }, [rawSendCommand]);

    const selectTask = useCallback((task) => {
        setCurrentTask(task);
        boltCounterRef.current = 0;
        sendCommand('LOAD_APP', { app_name: TASK_APP_NAMES[task] || task });
        showToast(`Task: ${TASK_NAMES[task] || task}`, 'info');
    }, [sendCommand, showToast]);

    // Wraps sendCommand for the Start button: sends bolt_config first, then start
    const sendStartCommand = useCallback(() => {
        boltCounterRef.current += 1;
        const num = boltCounterRef.current;
        sendCommand('BOLT_CONFIG', { boltNum: num, torqueNum: num });
        return sendCommand('START');
    }, [sendCommand]);

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
        sendStartCommand,
        consoleLines,
        addConsoleLine,
        taskNames: TASK_NAMES,
    }), [robotStatus, tcpConnected, wsConnected, logs, toasts, showToast, laserReading, currentTask, selectTask, sendCommand, sendStartCommand, consoleLines, addConsoleLine]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}
