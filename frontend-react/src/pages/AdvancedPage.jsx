import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import './AdvancedPage.css';

const COMMANDS = ['GET_STATUS', 'INITIALIZE', 'START', 'STOW', 'ABORT', 'HOME', 'READ_LASER', 'GET_PROGRESS'];

export default function AdvancedPage() {
    const { sendCommand, wsConnected, tcpConnected, currentTask, taskNames, consoleLines, addConsoleLine, showToast } = useApp();
    const [host, setHost] = useState('127.0.0.1');
    const [port, setPort] = useState('9999');
    const [command, setCommand] = useState('GET_STATUS');
    const [params, setParams] = useState('');
    const outputRef = useRef(null);

    const handleConnect = () => {
        const portNum = parseInt(port, 10);
        if (!host.trim() || !portNum) {
            showToast('Please enter a valid host and port', 'warning');
            return;
        }
        sendCommand('CONNECT', { host: host.trim(), port: portNum });
        showToast(`Connecting to ${host}:${port}...`, 'info');
    };

    const handleDisconnect = () => {
        sendCommand('DISCONNECT');
        showToast('Disconnecting...', 'info');
    };

    const handleSend = () => {
        let parsed = {};
        try {
            const raw = params.trim();
            if (raw) parsed = JSON.parse(raw);
        } catch (e) {
            addConsoleLine(`Error: Invalid JSON params — ${e.message}`, 'error');
            return;
        }

        addConsoleLine(`→ ${command} ${JSON.stringify(parsed)}`, 'sent');
        sendCommand(command, parsed);
        setParams('');
    };

    return (
        <div className="advanced-page">
            <div className="advanced-grid">
                <div className="adv-card">
                    <h3 className="adv-card-title">TCP Configuration</h3>
                    <div className="adv-form">
                        <div className="form-group">
                            <label htmlFor="tcp-host">Robot IP Address</label>
                            <input
                                id="tcp-host"
                                type="text"
                                value={host}
                                onChange={(e) => setHost(e.target.value)}
                                placeholder="e.g. 192.168.1.100"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="tcp-port">Robot Port</label>
                            <input
                                id="tcp-port"
                                type="number"
                                value={port}
                                onChange={(e) => setPort(e.target.value)}
                                placeholder="e.g. 9999"
                            />
                        </div>
                        <div className="form-row">
                            <button className="adv-btn primary" onClick={handleConnect}>Connect</button>
                            <button className="adv-btn danger" onClick={handleDisconnect}>Disconnect</button>
                        </div>
                        <div className="tcp-status">
                            <span className={`status-dot ${tcpConnected ? 'green' : 'red'}`}></span>
                            <span>{tcpConnected ? 'Connected' : 'Disconnected'}</span>
                        </div>
                    </div>
                </div>

                <div className="adv-card">
                    <h3 className="adv-card-title">System Information</h3>
                    <div className="sys-info">
                        <div className="sys-row"><span>Software Version</span><strong>2.0</strong></div>
                        <div className="sys-row">
                            <span>WebSocket</span>
                            <strong style={{ color: wsConnected ? 'var(--green)' : 'var(--red)' }}>
                                {wsConnected ? 'Connected' : 'Disconnected'}
                            </strong>
                        </div>
                        <div className="sys-row"><span>TCP Target</span><strong>{host}:{port}</strong></div>
                        <div className="sys-row"><span>Active Task</span><strong>{taskNames[currentTask] || 'None'}</strong></div>
                    </div>
                </div>

                <div className="adv-card full-width">
                    <h3 className="adv-card-title">Command Console</h3>
                    <div className="console-area">
                        <div className="console-output" ref={outputRef}>
                            {consoleLines.map((line, i) => (
                                <div key={line.id ?? i} className={`console-line ${line.type}`}>{line.text}</div>
                            ))}
                        </div>
                        <div className="console-input-row">
                            <select className="console-select" value={command} onChange={(e) => setCommand(e.target.value)}>
                                {COMMANDS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input
                                type="text"
                                className="console-input"
                                placeholder='Params JSON: {"key": "value"}'
                                value={params}
                                onChange={(e) => setParams(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            />
                            <button className="adv-btn primary" onClick={handleSend}>Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
