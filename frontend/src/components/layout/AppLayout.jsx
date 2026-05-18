import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
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
          <NavLink to="/animals/new">Alta animal</NavLink>
          <NavLink to="/reminders">Avisos</NavLink>
          <NavLink to="/pens">Corrales</NavLink>
          <NavLink to="/health">Sanidad</NavLink>
          <NavLink to="/movements">Movimientos</NavLink>
        <NavLink to="/movements/new">Alta movimiento</NavLink>
        </nav>

        <div className="sidebar-user">
          <p>{user?.nombre || user?.email}</p>
          <span>{user?.rol}</span>
          <button type="button" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}