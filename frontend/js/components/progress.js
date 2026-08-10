/**
 * Progress Component
 * Donut chart (CSS conic-gradient), linear progress bar, and process step checklist
 */

const ProgressComponent = {
    /**
     * Update the donut chart for gel task
     */
    updateDonutChart(gelData) {
        if (!gelData) return;

        const total = gelData.total || 9;
        const outerPct = (gelData.outer_gels / total) * 100;
        const innerPct = (gelData.inner_gels / total) * 100;
        const backersPct = (gelData.backers / total) * 100;
        const totalPct = ((gelData.outer_gels + gelData.inner_gels + gelData.backers) / (total * 3)) * 100;

        const chart = document.getElementById('donut-chart');
        if (chart) {
            const outerDeg = (outerPct / 100) * 360;
            const innerDeg = (innerPct / 100) * 360;
            const backersDeg = (backersPct / 100) * 360;
            const remainDeg = 360 - outerDeg - innerDeg - backersDeg;

            chart.style.background = `conic-gradient(
                #38bdf8 0deg ${outerDeg}deg,
                #1d4ed8 ${outerDeg}deg ${outerDeg + innerDeg}deg,
                #2dd4bf ${outerDeg + innerDeg}deg ${outerDeg + innerDeg + backersDeg}deg,
                #334155 ${outerDeg + innerDeg + backersDeg}deg 360deg
            )`;
        }

        const percentage = document.getElementById('donut-percentage');
        if (percentage) percentage.textContent = Math.round(totalPct) + '%';

        const outerEl = document.getElementById('gel-outer');
        const innerEl = document.getElementById('gel-inner');
        const backersEl = document.getElementById('gel-backers');
        if (outerEl) outerEl.textContent = `${gelData.outer_gels}/${total}`;
        if (innerEl) innerEl.textContent = `${gelData.inner_gels}/${total}`;
        if (backersEl) backersEl.textContent = `${gelData.backers}/${total}`;

        // Progress bar
        this.updateProgressBar('gel-progress-bar', 'gel-progress-text', totalPct);
    },

    /**
     * Update a linear progress bar
     */
    updateProgressBar(barId, textId, percentage) {
        const bar = document.getElementById(barId);
        consttext = document.getElementById(textId);

        if (bar) bar.style.width = Math.min(100, percentage) + '%';
        if (text) text.textContent = Math.round(percentage) + '%';
    },

    /**
     * Update the process steps checklist
     */
    updateProcessSteps(steps) {
        const container = document.getElementById('process-steps-container');
        const stepsEl = document.getElementById('process-steps');

        if (!container || !stepsEl) return;

        if (!steps || steps.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        stepsEl.innerHTML = '';

        steps.forEach(step => {
            const item = document.createElement('div');
            item.className = `step-item ${step.status}`;

            const check = document.createElement('div');
            check.className = `step-check ${step.status}`;
            check.textContent = step.status === 'complete' ? '✓' : step.status === 'in_progress' ? '●' : '';

            const name = document.createElement('span');
            name.className = 'step-name';
            name.textContent = step.name;

            item.appendChild(check);
            item.appendChild(name);
            stepsEl.appendChild(item);
        });
    },

    /**
     * Draw the bolt plate canvas visualization
     */
    drawBoltPlate(canvasId, boltPositions) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2 - 20;

        ctx.clearRect(0, 0, w, h);

        // Draw main plate circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw inner circles
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#f1f5f9';
        ctx.fill();
        ctx.stroke();

        // Center hole
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();

        // Draw bolt positions around the plate
        const boltCount = 40;
        const torqueColors = {
            0: '#94a3b8',  // Pending
            20: '#ef4444', // Red
            40: '#eab308', // Yellow
            60: '#22c55e', // Green
        };

        for (let i = 1; i <= boltCount; i++) {
            const angle = ((i - 1) / boltCount) * Math.PI * 2 - Math.PI / 2;
            const ring = i <= 14 ? radius * 0.8 : (i <= 28 ? radius * 0.55 : radius * 0.35);
            const subAngle = i <= 14
                ? ((i - 1) / 14) * Math.PI * 2 - Math.PI / 2
                : (i <= 28
                    ? ((i - 15) / 14) * Math.PI * 2 - Math.PI / 2
                    : ((i - 29) / 12) * Math.PI * 2 - Math.PI / 2);

            const bx = cx + Math.cos(subAngle) * ring;
            const by = cy + Math.sin(subAngle) * ring;

            const boltData = boltPositions ? boltPositions[i] : null;
            const torque = boltData ? boltData.torque : 0;
            const status = boltData ? boltData.status : 'pending';

            ctx.beginPath();
            ctx.arc(bx, by, 8, 0, Math.PI * 2);

            if (status === 'complete') {
                ctx.fillStyle = torqueColors[torque] || torqueColors[0];
            } else if (status === 'in_progress') {
                ctx.fillStyle = '#eab308';
            } else {
                ctx.fillStyle = '#cbd5e1';
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.fill();

            // Label for outer ring
            if (i <= 14) {
                ctx.fillStyle = '#475569';
                ctx.font = '9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const labelR = ring + 18;
                const lx = cx + Math.cos(subAngle) * labelR;
                const ly = cy + Math.sin(subAngle) * labelR;
                ctx.fillText(`J${i}`, lx, ly);
            }
        }
    }
};
