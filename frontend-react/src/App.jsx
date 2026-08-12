import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TaskLayout from './components/TaskLayout';
import MainPanelPage from './pages/MainPanelPage';
import CalibratePage from './pages/CalibratePage';
import VisionPage from './pages/VisionPage';
import LogsPage from './pages/LogsPage';
import DataPage from './pages/DataPage';
import AdvancedPage from './pages/AdvancedPage';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/:task" element={<TaskLayout />}>
                <Route index element={<MainPanelPage />} />
                <Route path="vision" element={<VisionPage />} />
                <Route path="logs" element={<LogsPage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="calibrate" element={<CalibratePage />} />
                <Route path="advanced" element={<AdvancedPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
