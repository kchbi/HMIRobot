import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 2000;

/**
 * Owns the single WebSocket connection to the backend and exposes
 * sendCommand()/message dispatch.
 *
 * Protocol matches bolt_cli.py / ws_server.py:
 *   Send:    {"type": "initialize"} or {"type": "move_x", "data": {"value": 1.0}}
 *   Receive: {"type": "command_received", "data": {...}}
 *            {"type": "update_state",    "data": {...}}
 *
 * Responses are matched via a FIFO queue (no id field).
 */
export function useWebSocket(onMessage) {
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const pendingRef = useRef([]);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const connect = useCallback(() => {
        // In dev (Vite proxy): connects to ws://localhost:5173/ws → proxied to backend
        // In production build: uses VITE_WS_URL env var to connect directly to backend
        const wsUrl = import.meta.env.VITE_WS_URL
            || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

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
                // FIFO: resolve the oldest pending sendCommand Promise
                if (message.type === 'command_received' && pendingRef.current.length) {
                    const resolve = pendingRef.current.shift();
                    resolve(message.data || {});
                }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const scheduleReconnect = useCallback(() => {
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            console.log('[WS] Max reconnect attempts reached');
            return;
        }
        reconnectAttemptsRef.current += 1;
        const delay = RECONNECT_BASE_DELAY * Math.min(reconnectAttemptsRef.current, 5);
        setTimeout(connect, delay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connect]);

    useEffect(() => {
        connect();
        return () => {
            wsRef.current?.close(1000);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sendCommand = useCallback((action, params = {}) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            return Promise.resolve({ status: 'error', message: 'Not connected to server' });
        }

        // Build message matching bolt_cli.py format: {"type": "initialize"}
        // Only include "data" key when params is non-empty
        const msg = { type: action.toLowerCase() };
        if (Object.keys(params).length) {
            msg.data = params;
        }
        ws.send(JSON.stringify(msg));

        return new Promise((resolve) => {
            pendingRef.current.push(resolve);
            setTimeout(() => {
                const idx = pendingRef.current.indexOf(resolve);
                if (idx !== -1) {
                    pendingRef.current.splice(idx, 1);
                    resolve({ status: 'error', message: 'Timeout' });
                }
            }, 15000);
        });
    }, []);

    return { connected, sendCommand };
}
