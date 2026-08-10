/**
 * Status Indicator Component
 * Reusable status dot + label + value with animated pulse states
 */

const StatusComponent = {
    /**
     * Update a status dot's color based on value
     */
    updateDot(dotEl, color) {
        dotEl.className = 'status-dot';
        dotEl.classList.add(color);
    },

    /**
     * Update the connection status display
     */
    updateConnectionStatus(connected) {
        const dot = document.getElementById('status-connected-dot');
        const value = document.getElementById('status-connected');
        const headerDot = document.querySelector('#connection-dot .dot');

        if (dot) {
            this.updateDot(dot, connected ? 'green' : 'red');
        }
        if (value) {
            value.textContent = connected ? 'Connected' : 'Disconnected';
        }
        if (headerDot) {
            headerDot.className = `dot ${connected ? 'connected' : 'disconnected'}`;
        }
    },

    /**
     * Update all status fields from robot status data
     */
    updateRobotStatus(data) {
        if (!data) return;

        // Connection
        this.updateConnectionStatus(data.connected !== false);

        // Current Command
        const cmdEl = document.getElementById('status-command');
        const cmdDot = document.getElementById('status-command-dot');
        if (cmdEl) cmdEl.textContent = data.current_command || 'NO COMMAND';
        if (cmdDot) {
            const isActive = data.current_command && data.current_command !== 'NO COMMAND';
            this.updateDot(cmdDot, isActive ? 'green' : 'yellow');
        }

        // Robot Mode
        const modeEl = document.getElementById('status-mode');
        const modeDot = document.getElementById('status-mode-dot');
        if (modeEl) modeEl.textContent = data.robot_mode || 'UNKNOWN';
        if (modeDot) {
            const mode = data.robot_mode || '';
            if (mode === 'RUNNING') {
                this.updateDot(modeDot, 'green');
            } else if (mode === 'INITIALIZING') {
                this.updateDot(modeDot, 'yellow');
            } else {
                this.updateDot(modeDot, 'yellow');
            }
        }

        // Program Running
        const progEl = document.getElementById('status-program');
        const progDot = document.getElementById('status-program-dot');
        if (progEl) progEl.textContent = String(data.program_running || false);
        if (progDot) {
            this.updateDot(progDot, data.program_running ? 'green' : 'yellow');
        }

        // Safety Status
        const safeEl = document.getElementById('status-safety');
        const safeDot = document.getElementById('status-safety-dot');
        if (safeEl) safeEl.textContent = data.safety_status || 'UNKNOWN';
        if (safeDot) {
            const safe = data.safety_status || '';
            this.updateDot(safeDot, safe === 'NORMAL' ? 'yellow' : 'red');
        }

        // Position
        if (data.position) {
            const posX = document.getElementById('pos-x');
            const posY = document.getElementById('pos-y');
            const posZ = document.getElementById('pos-z');
            if (posX) posX.textContent = (data.position.x || 0).toFixed(2);
            if (posY) posY.textContent = (data.position.y || 0).toFixed(2);
            if (posZ) posZ.textContent = (data.position.z || 0).toFixed(2);
        }
    }
};
