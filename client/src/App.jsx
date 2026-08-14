import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import HostPage from './pages/HostPage';
import HostDashboard from './pages/HostDashboard';
import UsersPage from './pages/UsersPage';
import JoinPage from './pages/JoinPage';
import ParticipantPage from './pages/ParticipantPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/rooms" element={<HostDashboard />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/host/:token" element={<HostPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/play/:code" element={<ParticipantPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
