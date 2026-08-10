/**
 * Calibrate Page — Robot movement, laser controls, calibration positions
 */

const CalibratePage = {
    init() {
        // Sub-tab navigation
        const calTabs = document.querySelectorAll('.cal-tab');
        calTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                calTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // Could show/hide sub-sections based on subtab
            });
        });

        // Calibration buttons
        const calBtns = document.querySelectorAll('.cal-btn[data-action]');
        calBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const params = {};

                if (btn.dataset.position) {
                    params.position = parseInt(btn.dataset.position);
                }

                if (window.App) {
                    App.sendCommand(action, params);
                }
            });
        });

        // Read Laser
        const laserBtn = document.getElementById('btn-read-laser');
        if (laserBtn) {
            laserBtn.addEventListener('click', () => {
                if (window.App) {
                    App.sendCommand('READ_LASER');
                }
            });
        }

        // Update Laser TCP
        const updateTcpBtn = document.getElementById('btn-update-tcp');
        if (updateTcpBtn) {
            updateTcpBtn.addEventListener('click', () => {
                if (window.App) {
                    App.sendCommand('UPDATE_LASER_TCP', { x: 0, y: 0, z: 0 });
                }
            });
        }

        // Initialize robot move component
        RobotMoveComponent.init();
    },

    /**
     * Handle laser reading response
     */
    onLaserReading(data) {
        const valueEl = document.getElementById('laser-value');
        if (valueEl && data.value !== undefined) {
            valueEl.textContent = `${data.value} ${data.unit || 'mm'}`;
        }
    }
};
