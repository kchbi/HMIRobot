import { useState } from 'react';
import { useApp } from '../context/AppContext';
import RobotMovePad from '../components/RobotMovePad';
import './CalibratePage.css';

const SUB_TABS = [
    { id: 'laser', label: 'Laser' },
    { id: 'camera', label: 'Camera' },
    { id: 'bolt', label: 'Bolt' },
    { id: 'clean', label: 'Clean' },
    { id: 'gel', label: 'Gel' },
];

export default function CalibratePage() {
    const { sendCommand, laserReading } = useApp();
    const [activeSubTab, setActiveSubTab] = useState('laser');

    return (
        <div className="calibrate-layout">
            <div className="cal-sidebar">
                {SUB_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`cal-tab${activeSubTab === tab.id ? ' active' : ''}`}
                        onClick={() => setActiveSubTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="cal-content">
                <div className="cal-left">
                    <div className="cal-section">
                        <h3>Calibration Position 1:</h3>
                        <div className="cal-btn-group">
                            <button className="hmi-btn cal-btn" onClick={() => sendCommand('GO_CALIBRATION', { position: 1 })}>Go</button>
                            <button className="hmi-btn cal-btn" onClick={() => sendCommand('SET_CALIBRATION', { position: 1 })}>Set</button>
                        </div>
                    </div>

                    <div className="cal-section">
                        <h3>Calibration Position 2:</h3>
                        <div className="cal-btn-group">
                            <button className="hmi-btn cal-btn" onClick={() => sendCommand('GO_CALIBRATION', { position: 2 })}>Go</button>
                            <button className="hmi-btn cal-btn" onClick={() => sendCommand('SET_CALIBRATION', { position: 2 })}>Set</button>
                        </div>
                    </div>

                    <div className="cal-section">
                        <h3>Update Laser TCP:</h3>
                        <button
                            className="hmi-btn cal-btn wide"
                            onClick={() => sendCommand('UPDATE_LASER_TCP', { x: 0, y: 0, z: 0 })}
                        >
                            Update
                        </button>
                    </div>

                    <div className="cal-section">
                        <h3>Take Measurement:</h3>
                        <button className="hmi-btn cal-btn wide" onClick={() => sendCommand('READ_LASER')}>
                            Read Laser
                        </button>
                        <div className="laser-reading">
                            <span className="reading-label">Last Reading:</span>
                            <span className="reading-value">
                                {laserReading?.value !== undefined
                                    ? `${laserReading.value} ${laserReading.unit || 'mm'}`
                                    : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="cal-right">
                    <RobotMovePad />
                </div>
            </div>
        </div>
    );
}
