/**
 * Advanced Page — TCP configuration, system info, command console
 */

const AdvancedPage = {
    init() {
        // TCP Connect button
        const connectBtn = document.getElementById('btn-tcp-connect');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                const host = document.getElementById('tcp-host').value.trim();
                const port = parseInt(document.getElementById('tcp-port').value);

                if (!host || !port) {
                    if (window.App) App.showToast('Please enter a valid host and port', 'warning');
                    return;
                }

                if (window.App) {
                    App.sendCommand('CONNECT', { host, port });
                    App.showToast(`Connecting to ${host}:${port}...`, 'info');
                }
            });
        }

        // TCP Disconnect button
        const disconnectBtn = document.getElementById('btn-tcp-disconnect');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                if (window.App) {
                    App.sendCommand('DISCONNECT');
                    App.showToast('Disconnecting...', 'info');
                }
            });
        }

        // Command console send
        const sendBtn = document.getElementById('btn-console-send');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendConsoleCommand());
        }

        // Enter key in params input
        const paramsInput = document.getElementById('console-params');
        if (paramsInput) {
            paramsInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.sendConsoleCommand();
            });
        }
    },

    sendConsoleCommand() {
        const select = document.getElementById('console-command');
        const paramsInput = document.getElementById('console-params');
        const output = document.getElementById('console-output');

        const action = select.value;
        let params = {};

        try {
            const raw = paramsInput.value.trim();
            if (raw) params = JSON.parse(raw);
        } catch (e) {
            this.addConsoleLine(`Error: Invalid JSON params — ${e.message}`, 'error');
            return;
        }

        this.addConsoleLine(`→ ${action} ${JSON.stringify(params)}`, 'sent');

        if (window.App) {
            App.sendCommand(action, params);
        }

        paramsInput.value = '';
    },

    addConsoleLine(text, type = 'system') {
        const output = document.getElementById('console-output');
        if (!output) return;

        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    },

    /**
     * Update TCP status display
     */
    updateTcpStatus(connected, host, port) {
        const dot = document.getElementById('tcp-status-dot');
        const text = document.getElementById('tcp-status-text');
        const target = document.getElementById('tcp-target-text');

        if (dot) {
            dot.className = `status-dot ${connected ? 'green' : 'red'}`;
        }
        if (text) {
            text.textContent = connected ? 'Connected' : 'Disconnected';
        }
        if (target && host && port) {
            target.textContent = `${host}:${port}`;
        }
    },

    /**
     * Update WebSocket status
     */
    updateWsStatus(connected) {
        const el = document.getElementById('ws-status-text');
        if (el) {
            el.textContent = connected ? 'Connected' : 'Disconnected';
            el.style.color = connected ? 'var(--green)' : 'var(--red)';
        }
    }
};
