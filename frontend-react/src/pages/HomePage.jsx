import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import ToastContainer from '../components/ToastContainer';
import './HomePage.css';

const TASKS = [
    {
        id: 'bolt',
        title: 'Top Plate Bolting',
        shape: 'circle',
        icon: (
            <svg className="task-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="35" y="8" width="10" height="30" rx="2" fill="#18213d" />
                <rect x="33" y="38" width="14" height="8" rx="2" fill="#64748b" />
                <rect x="30" y="46" width="20" height="6" rx="1" fill="#475569" />
                <rect x="28" y="52" width="24" height="4" rx="1" fill="#475569" />
                <rect x="32" y="56" width="16" height="12" rx="2" fill="#18213d" />
                <rect x="35" y="68" width="10" height="4" rx="1" fill="#18213d" />
            </svg>
        ),
    },
];

export default function HomePage() {
    const navigate = useNavigate();
    const { selectTask, showToast } = useApp();

    const handleSelect = (taskId) => {
        selectTask(taskId);
        navigate(`/${taskId}`);
    };

    return (
        <>
            <Header />
            <main className="home-page">
                <div className="home-container">
                    <div className="task-cards">
                        {TASKS.map((task) => (
                            <button
                                key={task.id}
                                className="task-card"
                                onClick={() => handleSelect(task.id)}
                            >
                                <h3 className="task-title">{task.title}</h3>
                                <div className={`task-icon-wrapper ${task.shape}`}>
                                    {task.icon}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    className="power-btn"
                    title="System Power"
                    onClick={() => showToast('System power control', 'info')}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                </button>
            </main>
            <ToastContainer />
        </>
    );
}
