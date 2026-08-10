/**
 * MO Cobot — Main Application Controller
 *
 * Manages:
 * - WebSocket connection to FastAPI backend
 * - Page/tab routing
 * - Global state
 * - Command dispatch
 * - Toast notifications
 */

const App = {
    // ─── State ─────────────────────────────────────────────────────────
    ws: null,
    wsConnected: false,
    currentPage: 'home',
    currentTask: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 2000,
    commandCallbacks: {},
    commandId: 0,

    // ─── Initialize ────────────────────────────────────────────────────
    init() {
        console.log('[App] MO Cobot initializing...');

        // Initialize all page modules
        HomePage.init();
        MainPanel.init();
        CalibratePage.init();
        VisionPage.init();
        LogsPage.init();
        AdvancedPage.init();

        // Tab bar navigation
        this.initTabBar();

        // Logo click → home
        const logoBtn = document.getElementById('logo-btn');
        if (logoBtn) {
            logoBtn.addEventListener('click', () => this.navigateTo('home'));
        }
        const hamburgerBtn = document.getElementById('hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                console.log('Hamburger menu clicked');
            });
        }

        // Connect WebSocket
        this.connectWebSocket();

        console.log('[App] Initialized');
    },

    // ─── WebSocket ─────────────────────────────────────────────────────
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        console.log(`[WS] Connecting to ${wsUrl}...`);

        try {
            this.ws = new WebSocket(wsUrl);
        } catch (e) {
            console.error('[WS] Failed to create WebSocket:', e);
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            console.log('[WS] Connected');
            this.wsConnected = true;
            this.reconnectAttempts = 0;
            AdvancedPage.updateWsStatus(true);
            this.showToast('Connected to server', 'success');
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (e) {
                console.error('[WS] Failed to parse message:', e);
            }
        };

        this.ws.onclose = (event) => {
            console.log(`[WS] Disconnected (code: ${event.code})`);
            this.wsConnected = false;
            AdvancedPage.updateWsStatus(false);
            StatusComponent.updateConnectionStatus(false);

            if (event.code !== 1000) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('[WS] Error:', error);
        };
    },

    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] Max reconnect attempts reached');
            this.showToast('Connection lost. Refresh the page to retry.', 'error');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => this.connectWebSocket(), delay);
    },

    // ─── Message Handler ───────────────────────────────────────────────
    handleMessage(message) {
        switch (message.type) {
            case 'status_update':
                this.onStatusUpdate(message.data);
                break;

            case 'connection':
                this.onConnectionUpdate(message.data);
                break;

            case 'command_response':
                this.onCommandResponse(message);
                break;

            case 'log':
                LogsPage.addEntry(message.data);
                break;

            case 'log_history':
                LogsPage.loadHistory(message.data);
                break;

            case 'error':
                console.error('[Server Error]', message.data);
                this.showToast(message.data?.message || 'Server error', 'error');
                break;

            default:
                console.log('[WS] Unknown message type:', message.type);
        }
    },

    onStatusUpdate(data) {
        // Update main panel
        MainPanel.onStatusUpdate(data);

        // Update position on calibrate page
        if (data.position) {
            RobotMoveComponent.updatePosition(data.position);
        }
    },

    onConnectionUpdate(data) {
        const connected = data.tcp_connected;
        StatusComponent.updateConnectionStatus(connected);

        const host = document.getElementById('tcp-host')?.value || '127.0.0.1';
        const port = document.getElementById('tcp-port')?.value || '9999';
        AdvancedPage.updateTcpStatus(connected, host, port);

        if (connected) {
            this.showToast('TCP connected to robot', 'success');
        }
    },

    onCommandResponse(message) {
        const { action, data, id } = message;

        // Handle specific command responses
        if (action === 'READ_LASER' && data.status === 'ok') {
            CalibratePage.onLaserReading(data);
        }

        if (action === 'CONNECT') {
            AdvancedPage.updateTcpStatus(
                data.connected,
                data.host,
                data.port
            );
        }

        // Console feedback
        if (data) {
            const msg = data.message || JSON.stringify(data);
            AdvancedPage.addConsoleLine(
                `← [${action}] ${msg}`,
                data.status === 'ok' ? 'received' : 'error'
            );
        }

        // Show toast for important responses
        if (data?.status === 'error') {
            this.showToast(`${action}: ${data.message}`, 'error');
        } else if (action === 'INITIALIZE' || action === 'START' || action === 'STOW' || action === 'ABORT') {
            this.showToast(`${action}: ${data?.message || 'OK'}`, data?.status === 'ok' ? 'success' : 'warning');
        }

        // Resolve callback
        if (id && this.commandCallbacks[id]) {
            this.commandCallbacks[id](data);
            delete this.commandCallbacks[id];
        }
    },

    // ─── Send Command ──────────────────────────────────────────────────
    sendCommand(action, params = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showToast('Not connected to server', 'error');
            return null;
        }

        const id = ++this.commandId;
        const message = { action, params, id };

        this.ws.send(JSON.stringify(message));
        console.log(`[CMD] ${action}`, params);

        return new Promise((resolve) => {
            this.commandCallbacks[id] = resolve;
            // Timeout after 15 seconds
            setTimeout(() => {
                if (this.commandCallbacks[id]) {
                    delete this.commandCallbacks[id];
                    resolve({ status: 'error', message: 'Timeout' });
                }
            }, 15000);
        });
    },

    // ─── Task Selection ────────────────────────────────────────────────
    selectTask(task) {
        this.currentTask = task;

        // Tell the server
        this.sendCommand('SET_TASK', { task });

        // Update the main panel visual
        MainPanel.setTask(task);

        // Navigate to main page
        this.navigateTo('main');

        const names = { bolt: 'Top Plate Bolting', clean: 'Chamber Cleaning', gel: 'Gel Installation' };
        this.showToast(`Task: ${names[task] || task}`, 'info');
    },

    // ─── Navigation ────────────────────────────────────────────────────
    initTabBar() {
        const tabs = document.querySelectorAll('.tab-item');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const page = tab.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        this.currentPage = page;

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) targetPage.classList.add('active');

        // Update tab bar
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-item[data-page="${page}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Show/hide tab bar (hidden on home page)
        const tabBar = document.getElementById('tab-bar');
        if (tabBar) {
            tabBar.classList.toggle('visible', page !== 'home');
        }

        // Show/hide power button (only on home)
        const powerBtn = document.getElementById('power-btn');
        if (powerBtn) {
            powerBtn.style.display = page === 'home' ? 'flex' : 'none';
        }
    },

    // ─── Toast Notifications ───────────────────────────────────────────
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
        };

        toast.innerHTML = `
            <span style="font-size: 1.1rem">${icons[type] || 'ℹ'}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove after 4 seconds
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};

// ─── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    window.App = App;
    App.init();
});
