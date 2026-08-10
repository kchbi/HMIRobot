/**
 * Home Page — Task selection landing page
 */

const HomePage = {
    init() {
        // Task card click handlers
        const cards = document.querySelectorAll('.task-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const task = card.dataset.task;
                if (window.App) {
                    App.selectTask(task);
                }
            });
        });

        // Power button
        const powerBtn = document.getElementById('power-btn');
        if (powerBtn) {
            powerBtn.addEventListener('click', () => {
                if (window.App) {
                    App.showToast('System power control', 'info');
                }
            });
        }
    }
};
