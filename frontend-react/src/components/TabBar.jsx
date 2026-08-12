import { NavLink, useParams } from 'react-router-dom';
import './TabBar.css';

const TABS = [
    { path: '', label: 'Main' },
    { path: 'vision', label: 'Vision' },
    { path: 'logs', label: 'Logs' },
    { path: 'calibrate', label: 'Calibrate' },
    { path: 'advanced', label: 'Advanced' },
];

export default function TabBar() {
    const { task } = useParams();

    return (
        <nav className="tab-bar visible">
            {TABS.map((tab) => (
                <NavLink
                    key={tab.label}
                    to={`/${task}${tab.path ? `/${tab.path}` : ''}`}
                    end={tab.path === ''}
                    className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
                >
                    <span className="tab-label">{tab.label}</span>
                </NavLink>
            ))}
        </nav>
    );
}
