import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import logo from '../assets/logo.png';
import './Header.css';

export default function Header() {
    const navigate = useNavigate();
    const { tcpConnected } = useApp();

    return (
        <header className="app-header">
            <div className="header-left">
                <button className="logo-btn" title="Go to Home" onClick={() => navigate('/')}>
                    <img className="logo-image" src={logo} alt="Company Logo" />
                </button>
            </div>
            <div className="header-center">
                <span className="app-title">MO Cobot</span>
            </div>
            <div className="header-right">
                <div className="connection-indicator" title="TCP Connection Status">
                    <span className={`dot ${tcpConnected ? 'connected' : 'disconnected'}`}></span>
                </div>
                <button className="hamburger-btn" aria-label="Menu">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>
            </div>
        </header>
    );
}
