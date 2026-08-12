import { useApp } from '../context/AppContext';
import './ToastContainer.css';

const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

export default function ToastContainer({ withNavbar = false }) {
    const { toasts } = useApp();

    return (
        <div className={`toast-container${withNavbar ? ' with-navbar' : ''}`}>
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    <span className="toast-icon">{ICONS[toast.type] || 'ℹ'}</span>
                    <span>{toast.message}</span>
                </div>
            ))}
        </div>
    );
}
