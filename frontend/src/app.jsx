import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AnimalsPage from './pages/AnimalsPage';
import AnimalDetailPage from './pages/AnimalDetailPage';
import CreateAnimalPage from './pages/CreateAnimalPage';
import AutomationPage from './pages/AutomationPage';
import PensPage from './pages/PensPage';
import HealthPage from './pages/HealthPage';
import MovementsPage from './pages/MovementsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/animals" element={<AnimalsPage />} />
        <Route path="/animals/new" element={<CreateAnimalPage />} />
        <Route path="/animals/:id" element={<AnimalDetailPage />} />
        <Route path="/automation" element={<AutomationPage />} />
        <Route path="/pens" element={<PensPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/movements" element={<MovementsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}