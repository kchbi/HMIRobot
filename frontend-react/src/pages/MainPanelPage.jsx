import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import StatusList from '../components/StatusList';
import ProcessSteps from '../components/ProcessSteps';
import BoltPlateVisual from '../components/BoltPlateVisual';
import ProgressDonut from '../components/ProgressDonut';
import ProgressBar from '../components/ProgressBar';
import './MainPanelPage.css';

export default function MainPanelPage() {
    const { task } = useParams();
    const { robotStatus, tcpConnected, sendCommand } = useApp();

    const progress = robotStatus.process_progress || 0;
    const initializing = robotStatus.robot_mode === 'INITIALIZING';
    const programRunning = !!robotStatus.program_running;

    const CONTROLS = [
        { action: 'INITIALIZE', label: 'Initialize', disabled: initializing },
        { action: 'START', label: 'Start', disabled: !robotStatus.initialized || programRunning },
        { action: 'STOW', label: 'Stow', disabled: programRunning },
    ];

    return (
        <div className="main-panel-layout">
            <section className="hmi-section section-control">
                <h2 className="hmi-heading">Control</h2>
                <div className="control-buttons">
                    {CONTROLS.map((btn) => (
                        <button
                            key={btn.action}
                            className="hmi-btn ctrl-btn"
                            disabled={btn.disabled}
                            onClick={() => sendCommand(btn.action)}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className="hmi-section section-status">
                <h2 className="hmi-heading">Status</h2>
                <StatusList status={robotStatus} connected={tcpConnected} />
                <ProcessSteps steps={robotStatus.process_steps} />
            </section>

            <section className="hmi-section section-visual">
                <h2 className="hmi-heading">Visual</h2>
                <div className="visual-area">
                    {task === 'bolt' && (
                        <BoltPlateVisual
                            boltPositions={robotStatus.bolt_positions}
                            activeBolt={robotStatus.active_bolt}
                            bolting={programRunning && robotStatus.active_task === 'bolt'}
                        />
                    )}
                    {task === 'gel' && (
                        <ProgressDonut gelData={robotStatus.gel_status} />
                    )}
                    {task === 'clean' && (
                        <div className="visual-clean">
                            <div className="clean-chamber-graphic">
                                <svg viewBox="0 0 300 300" className="chamber-svg">
                                    <circle cx="150" cy="150" r="130" fill="#f8fafc" stroke="#dbe3ea" strokeWidth="2" />
                                    <circle cx="150" cy="150" r="90" fill="#ffffff" stroke="#dbe3ea" strokeWidth="1.5" />
                                    <circle cx="150" cy="150" r="40" fill="#f8fafc" stroke="#14cfc0" strokeWidth="1" opacity="0.6" />
                                    {[1, 2, 3, 4].map((zone) => {
                                        const paths = {
                                            1: 'M150 20 A130 130 0 0 1 280 150 L150 150 Z',
                                            2: 'M280 150 A130 130 0 0 1 150 280 L150 150 Z',
                                            3: 'M150 280 A130 130 0 0 1 20 150 L150 150 Z',
                                            4: 'M20 150 A130 130 0 0 1 150 20 L150 150 Z',
                                        };
                                        const threshold = (zone / 4) * 80;
                                        return (
                                            <path
                                                key={zone}
                                                d={paths[zone]}
                                                fill="#14cfc0"
                                                opacity={progress >= threshold ? 0.35 : 0}
                                            />
                                        );
                                    })}
                                    <text x="150" y="155" textAnchor="middle" fill="#94a3b8" fontSize="14">Chamber</text>
                                </svg>
                            </div>
                            <div className="progress-section">
                                <h3>Cleaning Progress:</h3>
                                <ProgressBar percentage={progress} />
                            </div>
                        </div>
                    )}
                    {!task && (
                        <div className="visual-placeholder">
                            <p>Select a task from the Home screen to begin</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
