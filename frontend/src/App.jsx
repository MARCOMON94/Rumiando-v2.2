import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import DashboardPage from './pages/DashboardPage';
import AnimalsPage from './pages/AnimalsPage';
import AnimalDetailPage from './pages/AnimalDetailPage';
import CreateAnimalPage from './pages/CreateAnimalPage';
import AutomationPage from './pages/AutomationPage';
import PensPage from './pages/PensPage';
import HealthPage from './pages/HealthPage';
import MovementsPage from './pages/MovementsPage';
import CreateMovementPage from './pages/CreateMovementPage';
import RemindersPage from './pages/RemindersPage';
import AiChatPage from './pages/AiChatPage';
import HomePage from './pages/HomePage';
import AdminInvitationsPage from './pages/AdminInvitationsPage';
import AnimalWatchlistPage from './pages/AnimalWatchlistPage';
import BirthNewPage from './pages/BirthNewPage';
import AnimalDischargePage from './pages/AnimalDischargePage';

export default function App() {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem('rumiando-theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const theme = storedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/animals" element={<AnimalsPage />} />
        <Route path="/animals/new" element={<CreateAnimalPage />} />
        <Route path="/animals/:id" element={<AnimalDetailPage />} />
        <Route path="/animals/:id/discharge" element={<AnimalDischargePage />} />
        <Route path="/birth/new/:motherId" element={<BirthNewPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/pens" element={<PensPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/movements/new" element={<CreateMovementPage />} />
        <Route path="/movements" element={<MovementsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/animal-watchlist" element={<AnimalWatchlistPage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
        <Route path="/admin/invitations" element={<AdminInvitationsPage />} />
        <Route path="/ai-vet" element={<Navigate to="/ai-chat" replace />} />
        <Route path="/ai-manager" element={<Navigate to="/ai-chat" replace />} />
      </Route>

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
