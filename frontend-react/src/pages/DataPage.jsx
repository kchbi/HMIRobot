import './StubPage.css';

export default function DataPage() {
    return (
        <div className="stub-page">
            <div className="stub-feed">
                <div className="stub-placeholder">
                    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 24 L40 12 L66 24 L40 36 Z" />
                        <path d="M14 24 V56 L40 68 V36" />
                        <path d="M66 24 V56 L40 68" />
                    </svg>
                    <h3>Data</h3>
                    <p>No data source configured</p>
                    <p className="stub-hint">Data integration is not available yet.</p>
                </div>
            </div>
        </div>
    );
}
