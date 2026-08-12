import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import Header from './Header';
import TabBar from './TabBar';
import ToastContainer from './ToastContainer';
import { useApp } from '../context/AppContext';

const VALID_TASKS = ['bolt', 'clean', 'gel'];

export default function TaskLayout() {
    const { task } = useParams();
    const { currentTask, setCurrentTask, sendCommand } = useApp();

    useEffect(() => {
        if (task && task !== currentTask) {
            setCurrentTask(task);
            sendCommand('SET_TASK', { task });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [task]);

    if (!VALID_TASKS.includes(task)) {
        return <Navigate to="/" replace />;
    }

    return (
        <>
            <Header />
            <TabBar />
            <main className="app-main">
                <Outlet />
            </main>
            <ToastContainer withNavbar />
        </>
    );
}
