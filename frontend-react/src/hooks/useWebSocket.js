import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 2000;

/**
 * Owns the single WebSocket connection to the backend and exposes
 * sendCommand()/message dispatch, mirroring the contract of the
 * original vanilla-JS App.sendCommand (id-matched promises, 15s timeout).
 */
export function useWebSocket(onMessage) {
    const [connected, setConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const commandIdRef = useRef(0);
    const callbacksRef = useRef({});
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const connect = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

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
                if (message.type === 'command_response' && message.id && callbacksRef.current[message.id]) {
                    callbacksRef.current[message.id](message.data);
                    delete callbacksRef.current[message.id];
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

        const id = ++commandIdRef.current;
        ws.send(JSON.stringify({ action, params, id }));

        return new Promise((resolve) => {
            callbacksRef.current[id] = resolve;
            setTimeout(() => {
                if (callbacksRef.current[id]) {
                    delete callbacksRef.current[id];
                    resolve({ status: 'error', message: 'Timeout' });
                }
            }, 15000);
        });
    }, []);

    return { connected, sendCommand };
}
