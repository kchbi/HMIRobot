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
                if (connected) showToast('TCP connected to robot', 'success');
                break;
            }
            case 'command_received': {
                const data = message.data;
                if (data) {
                    const msg = data.message || JSON.stringify(data);
                    addConsoleLine(`← ${msg}`, data.status === 'ok' ? 'received' : 'error');
                }
                if (data?.status === 'error') {
                    showToast(data.message, 'error');
                } else if (data?.message) {
                    showToast(data.message, data?.status === 'ok' ? 'success' : 'warning');
                }
                // Handle laser reading
                if (data?.value !== undefined && data?.unit) {
                    setLaserReading(data);
                }

                setLogs((prev) => [...prev, {
                    timestamp: Date.now() / 1000,
                    level: data?.status === 'ok' ? 'INFO' : 'ERROR',
                    source: 'server',
                    message: data?.message || JSON.stringify(data),
                }]);
                break;

            }
            case 'load_app':
                // Acknowledgment for load_app — task loaded on server
                break;
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
                break;
            default:
                break;
        }
    }, [showToast, addConsoleLine]);

    const { connected: wsConnected, sendCommand } = useWebSocket(handleMessage);

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
