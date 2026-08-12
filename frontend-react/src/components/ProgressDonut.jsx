import ProgressBar from './ProgressBar';
import './ProgressDonut.css';

export default function ProgressDonut({ gelData }) {
    const total = gelData?.total || 9;
    const outer = gelData?.outer_gels || 0;
    const inner = gelData?.inner_gels || 0;
    const backers = gelData?.backers || 0;

    const outerDeg = (outer / total) * 360;
    const innerDeg = (inner / total) * 360;
    const backersDeg = (backers / total) * 360;
    const totalPct = ((outer + inner + backers) / (total * 3)) * 100;

    const background = `conic-gradient(
        #38bdf8 0deg ${outerDeg}deg,
        #1d4ed8 ${outerDeg}deg ${outerDeg + innerDeg}deg,
        #2dd4bf ${outerDeg + innerDeg}deg ${outerDeg + innerDeg + backersDeg}deg,
        #cbd5e1 ${outerDeg + innerDeg + backersDeg}deg 360deg
    )`;

    return (
        <div className="visual-gel">
            <div className="donut-chart-container">
                <div className="donut-chart" style={{ background }}>
                    <div className="donut-center">
                        <span className="donut-percentage">{Math.round(totalPct)}%</span>
                    </div>
                </div>
                <div className="donut-legend">
                    <div className="legend-item">
                        <span className="legend-dot" style={{ background: '#38bdf8' }}></span>
                        Outer Gels Placed: <strong>{outer}/{total}</strong>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot" style={{ background: '#1d4ed8' }}></span>
                        Inner Gels Placed: <strong>{inner}/{total}</strong>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot" style={{ background: '#2dd4bf' }}></span>
                        Backers Placed: <strong>{backers}/{total}</strong>
                    </div>
                </div>
            </div>
            <div className="progress-section">
                <h3>Gels Placed:</h3>
                <ProgressBar percentage={totalPct} />
            </div>
        </div>
    );
}
