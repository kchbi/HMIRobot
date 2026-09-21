import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 2000;

/**
 * Owns the single WebSocket connection to the backend and exposes
 * sendCommand() / message dispatch.
 *
 * Protocol (matches real ws_server.py):
 *   Send:    {"type": "initialize"} or {"type": "load_app", "data": {"app_name": "TopPlateBolt"}}
 *   Receive: {"type": "command_received", "data": "1"}   ← data code identifies the command
 *            {"type": "update_state",     "data": {...}}
 *            {"type": "load_app",         "data": {...}}
 *
 * No FIFO queue — responses are matched by their data code, not by send order.
 */
export function useWebSocket(onMessage) {
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

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
                // Dispatch every message to AppContext.handleMessage
                // No FIFO queue — response matching is done by data code in AppContext
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

    /**
     * Fire-and-forget: sends the command over WebSocket.
     * Does NOT return a Promise that waits for a response.
     * Response handling is done in AppContext.handleMessage via data code matching.
     */
    const sendCommand = useCallback((action, params = {}) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn('[WS] Not connected, cannot send:', action);
            return;
        }

        const msg = { type: action.toLowerCase() };
        // params may be an object of fields, or a scalar payload
        // (e.g. {"type": "calibration", "data": "start"})
        if (params !== null && params !== undefined) {
            if (typeof params === 'object') {
                if (Object.keys(params).length) msg.data = params;
            } else {
                msg.data = params;
            }
        }
        ws.send(JSON.stringify(msg));
    }, []);

    return { connected, sendCommand };
}
