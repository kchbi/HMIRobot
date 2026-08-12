import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const AppContext = createContext(null);

const TASK_NAMES = { bolt: 'Top Plate Bolting', clean: 'Chamber Cleaning', gel: 'Gel Installation' };

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
            case 'status_update':
                setRobotStatus(message.data || {});
                break;
            case 'connection': {
                const connected = message.data?.tcp_connected;
                setTcpConnected(!!connected);
                if (connected) showToast('TCP connected to robot', 'success');
                break;
            }
            case 'command_response': {
                const { action, data } = message;
                if (action === 'READ_LASER' && data?.status === 'ok') {
                    setLaserReading(data);
                }
                if (data) {
                    const msg = data.message || JSON.stringify(data);
                    addConsoleLine(`← [${action}] ${msg}`, data.status === 'ok' ? 'received' : 'error');
                }
                if (data?.status === 'error') {
                    showToast(`${action}: ${data.message}`, 'error');
                } else if (['INITIALIZE', 'START', 'STOW', 'ABORT'].includes(action)) {
                    showToast(`${action}: ${data?.message || 'OK'}`, data?.status === 'ok' ? 'success' : 'warning');
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
        sendCommand('SET_TASK', { task });
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
