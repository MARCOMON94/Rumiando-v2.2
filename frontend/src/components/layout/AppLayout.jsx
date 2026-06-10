import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  function toggleSettings() {
    setSettingsOpen((current) => !current);
  }

  function closeSettings() {
    setSettingsOpen(false);
  }

  function handleLogout() {
    closeSettings();
    logout();
  }

  return (
    <div className="app-shell clean-app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>RumiAndo</h1>
            <p>Gestión ganadera</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/animals">Animales</NavLink>
          <NavLink to="/reminders">Avisos</NavLink>
          <NavLink to="/pens">Corrales</NavLink>
          <NavLink to="/health">Sanidad</NavLink>
          <NavLink to="/movements">Movimientos</NavLink>
          <NavLink to="/ai-chat">Asistente IA</NavLink>
        </nav>

        <div className="sidebar-user">
          <p>{user?.nombre || user?.email}</p>
          <span>{user?.rol}</span>
          <button type="button" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content clean-main-content" key={location.pathname}>
        <Outlet />
      </main>

      {settingsOpen && (
        <div className="mobile-settings-panel">
          <div>
            <strong>{user?.nombre || user?.email || 'Usuario'}</strong>
            <span>{user?.rol || 'Sesión activa'}</span>
          </div>

          <button type="button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      )}

      <button
        type="button"
        className={`mobile-settings-button ${settingsOpen ? 'open' : ''}`}
        onClick={toggleSettings}
        aria-label="Abrir configuración"
      >
        <span className="css-settings-icon" aria-hidden="true" />
      </button>

      <nav className="mobile-bottom-nav" aria-label="Navegación principal móvil">
        <NavLink to="/home" className="mobile-nav-button" onClick={closeSettings}>
          Inicio
        </NavLink>

        <NavLink to="/animals" className="mobile-nav-button" onClick={closeSettings}>
          Censo
        </NavLink>

        <NavLink to="/home" className="mobile-search-button" aria-label="Lector" onClick={closeSettings}>
          <span className="css-search-icon" aria-hidden="true" />
        </NavLink>

        <NavLink to="/ai-chat" className="mobile-nav-button" onClick={closeSettings}>
          IA
        </NavLink>

        <NavLink to="/reminders" className="mobile-nav-button" onClick={closeSettings}>
          Avisos
        </NavLink>
      </nav>
    </div>
  );
}
