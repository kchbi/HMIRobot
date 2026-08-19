import './StatusList.css';

function dotColorForCommand(currentCommand) {
    const isActive = currentCommand && currentCommand !== 'NO COMMAND';
    return isActive ? 'green' : 'yellow';
}

function dotColorForMode(mode) {
    if (mode === 'RUNNING') return 'green';
    return 'yellow';
}

export default function StatusList({ status, connected }) {
    const {
        current_command: currentCommand = 'NO COMMAND',
        robot_mode: robotMode = 'POWER_OFF',
        program_running: programRunning = false,
        safety_status: safetyStatus = 'NORMAL',
    } = status || {};

    return (
        <div className="status-list">
            <div className="status-item">
                <span className={`status-dot ${connected ? 'green' : 'red'}`}></span>
                <span className="status-label">Connected:</span>
                <span className="status-value">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="status-item">
                <span className={`status-dot ${dotColorForCommand(currentCommand)}`}></span>
                <span className="status-label">Current Command:</span>
                <span className="status-value">{currentCommand}</span>
            </div>
            <div className="status-item">
                <span className={`status-dot ${dotColorForMode(robotMode)}`}></span>
                <span className="status-label">Robot Mode:</span>
                <span className="status-value">{robotMode}</span>
            </div>
            <div className="status-item">
                <span className={`status-dot ${programRunning ? 'green' : 'yellow'}`}></span>
                <span className="status-label">Program Running:</span>
                <span className="status-value">{String(programRunning)}</span>
            </div>
            <div className="status-item">
                <span className={`status-dot ${safetyStatus === 'NORMAL' ? 'yellow' : 'red'}`}></span>
                <span className="status-label">Safety Status:</span>
                <span className="status-value">{safetyStatus}</span>
            </div>
        </div>
    );
}
