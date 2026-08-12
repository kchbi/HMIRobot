import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import './LogsPage.css';

const FILTERS = ['all', 'INFO', 'WARN', 'ERROR'];

export default function LogsPage() {
    const { logs, setLogs } = useApp();
    const [activeFilter, setActiveFilter] = useState('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const outputRef = useRef(null);

    const filtered = activeFilter === 'all' ? logs : logs.filter((e) => e.level === activeFilter);

    useEffect(() => {
        if (autoScroll && outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [filtered.length, autoScroll]);

    const exportLogs = () => {
        const text = logs.map((e) => {
            const time = new Date(e.timestamp * 1000).toISOString();
            return `${time} [${e.level}] [${e.source}] ${e.message}`;
        }).join('\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cobot_logs_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="logs-page">
            <div className="logs-toolbar">
                <div className="log-filters">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            className={`log-filter${activeFilter === f ? ' active' : ''}`}
                            onClick={() => setActiveFilter(f)}
                        >
                            {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
                <div className="log-actions">
                    <button className="log-action-btn" onClick={() => setLogs([])}>Clear</button>
                    <button className="log-action-btn" onClick={exportLogs}>Export</button>
                    <label className="log-autoscroll">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                        />
                        Auto-scroll
                    </label>
                </div>
            </div>
            <div className="logs-output" ref={outputRef}>
                {filtered.length === 0 && <div className="log-empty">No log entries</div>}
                {filtered.map((entry, i) => {
                    const time = new Date(entry.timestamp * 1000);
                    const timeStr = time.toLocaleTimeString('en-US', { hour12: false });
                    return (
                        <div className="log-entry" key={i}>
                            <span className="log-time">{timeStr}</span>
                            <span className={`log-level ${entry.level}`}>{entry.level}</span>
                            <span className="log-source">[{entry.source || 'sys'}]</span>
                            <span className="log-msg">{entry.message}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
