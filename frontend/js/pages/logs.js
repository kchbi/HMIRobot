/**
 * Logs Page — Real-time scrolling log viewer with filtering
 */

const LogsPage = {
    entries: [],
    activeFilter: 'all',
    autoScroll: true,

    init() {
        // Filter buttons
        const filters = document.querySelectorAll('.log-filter');
        filters.forEach(btn => {
            btn.addEventListener('click', () => {
                filters.forEach(f => f.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.dataset.level;
                this.renderLogs();
            });
        });

        // Auto-scroll checkbox
        const autoScrollCb = document.getElementById('log-autoscroll');
        if (autoScrollCb) {
            autoScrollCb.addEventListener('change', () => {
                this.autoScroll = autoScrollCb.checked;
            });
        }

        // Clear button
        const clearBtn = document.getElementById('btn-clear-logs');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.entries = [];
                this.renderLogs();
            });
        }

        // Export button
        const exportBtn = document.getElementById('btn-export-logs');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogs());
        }

        // Pause auto-scroll when user scrolls up
        const output = document.getElementById('logs-output');
        if (output) {
            output.addEventListener('scroll', () => {
                const isAtBottom = output.scrollTop + output.clientHeight >= output.scrollHeight - 20;
                if (!isAtBottom && this.autoScroll) {
                    // User scrolled up
                }
            });
        }
    },

    /**
     * Add a single log entry
     */
    addEntry(entry) {
        this.entries.push(entry);

        // Cap at 1000 entries
        if (this.entries.length > 1000) {
            this.entries.shift();
        }

        // If the entry matches the current filter, append it
        if (this.activeFilter === 'all' || entry.level === this.activeFilter) {
            this.appendEntryToDOM(entry);
        }
    },

    /**
     * Load log history (batch)
     */
    loadHistory(entries) {
        this.entries = entries || [];
        this.renderLogs();
    },

    /**
     * Render all visible logs
     */
    renderLogs() {
        const output = document.getElementById('logs-output');
        if (!output) return;

        const filtered = this.activeFilter === 'all'
            ? this.entries
            : this.entries.filter(e => e.level === this.activeFilter);

        if (filtered.length === 0) {
            output.innerHTML = '<div class="log-empty">No log entries</div>';
            return;
        }

        output.innerHTML = '';
        filtered.forEach(entry => this.appendEntryToDOM(entry));
    },

    /**
     * Append a single entry to the DOM
     */
    appendEntryToDOM(entry) {
        const output = document.getElementById('logs-output');
        if (!output) return;

        // Remove empty message if present
        const empty = output.querySelector('.log-empty');
        if (empty) empty.remove();

        const el = document.createElement('div');
        el.className = 'log-entry';

        const time = new Date(entry.timestamp * 1000);
        const timeStr = time.toLocaleTimeString('en-US', { hour12: false });

        el.innerHTML = `
            <span class="log-time">${timeStr}</span>
            <span class="log-level ${entry.level}">${entry.level}</span>
            <span class="log-source">[${entry.source || 'sys'}]</span>
            <span class="log-msg">${this.escapeHtml(entry.message)}</span>
        `;

        output.appendChild(el);

        // Auto-scroll
        if (this.autoScroll) {
            output.scrollTop = output.scrollHeight;
        }
    },

    /**
     * Export logs as text file
     */
    exportLogs() {
        const text = this.entries.map(e => {
            const time = new Date(e.timestamp * 1000).toISOString();
            return `${time} [${e.level}] [${e.source}] ${e.message}`;
        }).join('\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cobot_logs_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
