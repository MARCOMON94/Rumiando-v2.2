import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>RumiAndo</h1>
            <p>Gestión ganadera</p>
          </div>
        </div>

        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </header>

      {menuOpen && <div className="sidebar-overlay" onClick={closeMenu} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <h1>RumiAndo</h1>
            <p>Gestión ganadera</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" onClick={closeMenu}>Dashboard</NavLink>
          <NavLink to="/animals" onClick={closeMenu}>Animales</NavLink>
          <NavLink to="/reminders" onClick={closeMenu}>Avisos</NavLink>
          <NavLink to="/pens" onClick={closeMenu}>Corrales</NavLink>
          <NavLink to="/health" onClick={closeMenu}>Sanidad</NavLink>
          <NavLink to="/movements" onClick={closeMenu}>Movimientos</NavLink>
        </nav>

        <div className="sidebar-user">
          <p>{user?.nombre || user?.email}</p>
          <span>{user?.rol}</span>
          <button type="button" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main-content" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  );
}