import { useEffect, useRef } from 'react';
import './BoltPlateCanvas.css';

const TORQUE_COLORS = {
    0: '#cbd5e1',
    20: '#ef4444',
    40: '#eab308',
    60: '#22c55e',
};

function draw(canvas, boltPositions) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 20;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();

    const boltCount = 40;

    for (let i = 1; i <= boltCount; i++) {
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
            ctx.fillStyle = TORQUE_COLORS[torque] || TORQUE_COLORS[0];
        } else if (status === 'in_progress') {
            ctx.fillStyle = '#eab308';
        } else {
            ctx.fillStyle = '#e2e8f0';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.fill();

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

export default function BoltPlateCanvas({ boltPositions }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        draw(canvasRef.current, boltPositions);
    }, [boltPositions]);

    return (
        <div className="visual-bolt">
            <canvas ref={canvasRef} id="bolt-canvas" width="600" height="600" />
            <div className="torque-legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: '#ef4444' }}></span>20 lb-in</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }}></span>40 lb-in</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }}></span>60 lb-in</div>
            </div>
        </div>
    );
}
