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
// CLEANUP-CANDIDATE: /movements/new is replaced by /operations/movement.
// import CreateMovementPage from './pages/CreateMovementPage';
import RemindersPage from './pages/RemindersPage';
import AiChatPage from './pages/AiChatPage';
import HomePage from './pages/HomePage';
import AdminInvitationsPage from './pages/AdminInvitationsPage';
import AnimalWatchlistPage from './pages/AnimalWatchlistPage';
import BirthNewPage from './pages/BirthNewPage';
import AnimalDischargePage from './pages/AnimalDischargePage';
import OperationFlowPage from './pages/OperationFlowPage';
import OffspringPage from './pages/OffspringPage';

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
        <Route path="/offspring" element={<OffspringPage />} />
        <Route path="/operations/:type" element={<OperationFlowPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/pens" element={<PensPage />} />
        <Route path="/health" element={<HealthPage />} />
        {/* CLEANUP-CANDIDATE: legacy movement form disabled; use /operations/movement. */}
        <Route path="/movements/new" element={<Navigate to="/operations/movement" replace />} />
        <Route path="/movements" element={<MovementsPage />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/animal-watchlist" element={<AnimalWatchlistPage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
        <Route path="/admin/invitations" element={<AdminInvitationsPage />} />
        <Route path="/ai-vet" element={<Navigate to="/ai-chat" replace />} />
        <Route path="/ai-manager" element={<Navigate to="/ai-chat" replace />} />
      </Route>

      <Route
        path="/ai-chat/operation/:type"
        element={(
          <ProtectedRoute>
            <OperationFlowPage />
          </ProtectedRoute>
        )}
      />

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
