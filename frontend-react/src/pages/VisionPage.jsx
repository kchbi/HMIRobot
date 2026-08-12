import './StubPage.css';

export default function VisionPage() {
    return (
        <div className="stub-page">
            <div className="stub-feed">
                <div className="stub-placeholder">
                    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="10" y="18" width="60" height="44" rx="4" />
                        <circle cx="40" cy="40" r="12" />
                        <circle cx="40" cy="40" r="4" />
                        <rect x="30" y="12" width="20" height="8" rx="2" />
                    </svg>
                    <h3>Camera Feed</h3>
                    <p>No video source configured</p>
                    <p className="stub-hint">Connect a camera or vision system to enable live feed</p>
                </div>
            </div>
            <div className="stub-info">
                <span className="status-dot red"></span>
                <span>Camera: Disconnected</span>
            </div>
        </div>
    );
}
