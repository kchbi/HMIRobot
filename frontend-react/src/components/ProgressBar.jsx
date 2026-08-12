import './ProgressBar.css';

export default function ProgressBar({ percentage = 0 }) {
    const clamped = Math.min(100, Math.max(0, percentage));
    return (
        <div className="progress-bar-row">
            <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${clamped}%` }} />
            </div>
            <span className="progress-text">{Math.round(clamped)}%</span>
        </div>
    );
}
