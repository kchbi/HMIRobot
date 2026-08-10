/**
 * Main Panel Page — Control, Status, Visual columns
 */

const MainPanel = {
    currentTask: null,

    init() {
        // Control buttons
        const ctrlBtns = document.querySelectorAll('.ctrl-btn[data-action]');
        ctrlBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (window.App) {
                    App.sendCommand(action);
                }

                // Visual feedback
                btn.classList.add('sending');
                setTimeout(() => btn.classList.remove('sending'), 300);
            });
        });
    },

    /**
     * Set the active task and update the visual area
     */
    setTask(task) {
        this.currentTask = task;

        // Hide all visuals
        document.getElementById('visual-bolt').style.display = 'none';
        document.getElementById('visual-gel').style.display = 'none';
        document.getElementById('visual-clean').style.display = 'none';
        document.getElementById('visual-placeholder').style.display = 'none';

        // Show relevant visual
        switch (task) {
            case 'bolt':
                document.getElementById('visual-bolt').style.display = 'flex';
                ProgressComponent.drawBoltPlate('bolt-canvas', null);
                break;
            case 'gel':
                document.getElementById('visual-gel').style.display = 'flex';
                ProgressComponent.updateDonutChart({
                    outer_gels: 0, inner_gels: 0, backers: 0, total: 9
                });
                break;
            case 'clean':
                document.getElementById('visual-clean').style.display = 'flex';
                break;
            default:
                document.getElementById('visual-placeholder').style.display = 'block';
        }

        // Update active task text
        const taskText = document.getElementById('active-task-text');
        if (taskText) {
            const names = { bolt: 'Top Plate Bolting', clean: 'Chamber Cleaning', gel: 'Gel Installation' };
            taskText.textContent = names[task] || 'None';
        }
    },

    /**
     * Handle status update from robot
     */
    onStatusUpdate(data) {
        // Update status indicators
        StatusComponent.updateRobotStatus(data);

        // Update process steps
        if (data.process_steps) {
            ProgressComponent.updateProcessSteps(data.process_steps);
        }

        // Update task-specific visuals
        if (data.active_task === 'bolt' && data.bolt_positions) {
            ProgressComponent.drawBoltPlate('bolt-canvas', data.bolt_positions);
        }

        if (data.active_task === 'gel' && data.gel_status) {
            ProgressComponent.updateDonutChart(data.gel_status);
        }

        if (data.active_task === 'clean') {
            ProgressComponent.updateProgressBar(
                'clean-progress-bar', 'clean-progress-text',
                data.process_progress || 0
            );

            // Update chamber zone highlights
            const progress = data.process_progress || 0;
            for (let i = 1; i <= 4; i++) {
                const zone = document.getElementById(`clean-zone-${i}`);
                if (zone) {
                    const zoneThreshold = (i / 4) * 80;
                    zone.setAttribute('opacity', progress >= zoneThreshold ? '0.3' : '0');
                }
            }
        }

        // Update position
        if (data.position) {
            RobotMoveComponent.updatePosition(data.position);
        }
    }
};
