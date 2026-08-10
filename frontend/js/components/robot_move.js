/**
 * Robot Movement Pad Component
 * Handles D-pad button events and step size control
 */

const RobotMoveComponent = {
    stepSize: 1.0,

    init() {
        // Step size slider
        const slider = document.getElementById('step-size');
        const display = document.getElementById('step-value');

        if (slider) {
            slider.addEventListener('input', () => {
                this.stepSize = parseFloat(slider.value);
                if (display) display.textContent = this.stepSize.toFixed(1);
            });
        }

        // D-pad buttons
        const dpadBtns = document.querySelectorAll('.dpad-btn');
        dpadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const direction = parseFloat(btn.dataset.direction);
                const value = direction * this.stepSize;

                if (window.App) {
                    App.sendCommand(action, { value });
                }
            });

            // Keyboard support for held buttons
            btn.addEventListener('mousedown', () => btn.classList.add('pressing'));
            btn.addEventListener('mouseup', () => btn.classList.remove('pressing'));
            btn.addEventListener('mouseleave', () => btn.classList.remove('pressing'));
        });

        // Keyboard shortcuts for movement
        document.addEventListener('keydown', (e) => {
            // Only when calibrate page is active
            const calPage = document.getElementById('page-calibrate');
            if (!calPage || !calPage.classList.contains('active')) return;

            let action = null;
            let direction = 0;

            switch (e.key) {
                case 'ArrowUp':
                case 'w': case 'W':
                    action = 'MOVE_Y'; direction = 1; break;
                case 'ArrowDown':
                case 's': case 'S':
                    action = 'MOVE_Y'; direction = -1; break;
                case 'ArrowLeft':
                case 'a': case 'A':
                    action = 'MOVE_X'; direction = -1; break;
                case 'ArrowRight':
                case 'd': case 'D':
                    action = 'MOVE_X'; direction = 1; break;
            }

            if (action && !e.repeat) {
                e.preventDefault();
                const value = direction * this.stepSize;
                if (window.App) {
                    App.sendCommand(action, { value });
                }

                // Visual feedback
                const selector = action === 'MOVE_Y'
                    ? (direction > 0 ? '.dpad-btn.up' : '.dpad-btn.down')
                    : (direction > 0 ? '.dpad-btn.right' : '.dpad-btn.left');
                const btn = document.querySelector(selector);
                if (btn) {
                    btn.classList.add('pressing');
                    setTimeout(() => btn.classList.remove('pressing'), 150);
                }
            }
        });
    },

    /**
     * Update position display from status data
     */
    updatePosition(position) {
        if (!position) return;
        const posX = document.getElementById('pos-x');
        const posY = document.getElementById('pos-y');
        const posZ = document.getElementById('pos-z');
        if (posX) posX.textContent = (position.x || 0).toFixed(2);
        if (posY) posY.textContent = (position.y || 0).toFixed(2);
        if (posZ) posZ.textContent = (position.z || 0).toFixed(2);
    }
};
