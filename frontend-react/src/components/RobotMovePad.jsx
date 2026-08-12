import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import './RobotMovePad.css';

export default function RobotMovePad() {
    const { sendCommand, robotStatus } = useApp();
    const [stepSize, setStepSize] = useState(1.0);
    const stepSizeRef = useRef(stepSize);
    stepSizeRef.current = stepSize;
    const [pressing, setPressing] = useState(null);

    const move = (action, direction) => {
        const value = direction * stepSizeRef.current;
        sendCommand(action, { value });
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            let action = null;
            let direction = 0;

            switch (e.key) {
                case 'ArrowUp':
                case 'w': case 'W':
                    action = 'MOVE_Y'; direction = 1; break;
                case 'ArrowDown':
                case 's': case 'S':
                    action = 'MOVE_Y'; direction = -1; break;
                case 'ArrowLeft':
                case 'a': case 'A':
                    action = 'MOVE_X'; direction = -1; break;
                case 'ArrowRight':
                case 'd': case 'D':
                    action = 'MOVE_X'; direction = 1; break;
                default:
                    return;
            }

            if (!e.repeat) {
                e.preventDefault();
                move(action, direction);
                const key = action === 'MOVE_Y' ? (direction > 0 ? 'up' : 'down') : (direction > 0 ? 'right' : 'left');
                setPressing(key);
                setTimeout(() => setPressing(null), 150);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const position = robotStatus?.position || { x: 0, y: 0, z: 0 };

    return (
        <div className="move-robot-section">
            <h3>Move Robot</h3>
            <div className="dpad-container">
                <button
                    className={`dpad-btn up${pressing === 'up' ? ' pressing' : ''}`}
                    onClick={() => move('MOVE_Y', 1)}
                >+Y</button>
                <button
                    className={`dpad-btn left${pressing === 'left' ? ' pressing' : ''}`}
                    onClick={() => move('MOVE_X', -1)}
                >-X</button>
                <button
                    className={`dpad-btn right${pressing === 'right' ? ' pressing' : ''}`}
                    onClick={() => move('MOVE_X', 1)}
                >+X</button>
                <button
                    className={`dpad-btn down${pressing === 'down' ? ' pressing' : ''}`}
                    onClick={() => move('MOVE_Y', -1)}
                >-Y</button>
            </div>
            <div className="step-size-control">
                <label htmlFor="step-size">Step Size</label>
                <input
                    type="range"
                    id="step-size"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={stepSize}
                    onChange={(e) => setStepSize(parseFloat(e.target.value))}
                />
                <span className="step-value">{stepSize.toFixed(1)}</span>
            </div>
            <div className="position-display">
                <span>X: <strong>{(position.x || 0).toFixed(2)}</strong></span>
                <span>Y: <strong>{(position.y || 0).toFixed(2)}</strong></span>
                <span>Z: <strong>{(position.z || 0).toFixed(2)}</strong></span>
            </div>
        </div>
    );
}
