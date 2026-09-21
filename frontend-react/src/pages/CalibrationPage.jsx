import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import ToastContainer from '../components/ToastContainer';
import './CalibrationPage.css';

// Both buttons send {"type": "caliberation", "data": <mode>}
const ACTIONS = [
    {
        mode: 'start',
        label: 'Start Calibration',
        hint: 'Runs the full calibration routine',
        variant: 'primary',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
                <line x1="12" y1="1.5" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22.5" />
                <line x1="1.5" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22.5" y2="12" />
            </svg>
        ),
    },
    {
        mode: 'validate',
        label: 'Validate Calibration',
        hint: 'Checks the stored calibration is still good',
        variant: 'secondary',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.5 20 6v6c0 4.6-3.2 8.3-8 9.5-4.8-1.2-8-4.9-8-9.5V6z" />
                <polyline points="8.5 12 11 14.5 15.5 9.5" />
            </svg>
        ),
    },
];

export default function CalibrationPage() {
    const navigate = useNavigate();
    const { tcpConnected, sendCommand } = useApp();

    // This is a standalone pre-task step, so it does not depend on a loaded
    // app or an initialized run — only on the robot link being up.
    return (
        <>
            <Header />
            <main className="calibration-page">
                <div className="calibration-card">
                    <div className="calibration-top">
                        <div>
                            <h2 className="calibration-title">Calibration</h2>
                            <p className="calibration-intro">
                                Run this before starting a task.
                            </p>
                        </div>
                        <div className={`calibration-status${tcpConnected ? ' online' : ''}`}>
                            <span className="status-dot" />
                            {tcpConnected ? 'Robot connected' : 'Robot offline'}
                        </div>
                    </div>

                    <div className="calibration-actions">
                        {ACTIONS.map((btn) => (
                            <button
                                key={btn.mode}
                                className={`calibration-action ${btn.variant}`}
                                disabled={!tcpConnected}
                                onClick={() => sendCommand('CALIBERATION', btn.mode)}
                            >
                                <span className="action-icon">{btn.icon}</span>
                                <span className="action-text">
                                    <span className="action-label">{btn.label}</span>
                                    <span className="action-hint">{btn.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {!tcpConnected && (
                        <p className="calibration-warning">
                            Not connected to the robot — calibration is unavailable.
                        </p>
                    )}

                    <button className="calibration-back" onClick={() => navigate('/')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Home
                    </button>
                </div>
            </main>
            <ToastContainer />
        </>
    );
}
