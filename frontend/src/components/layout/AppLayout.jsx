import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="app-shell clean-app-shell">
      <main className="main-content clean-main-content">
        <Outlet />
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navegación principal">
        <button type="button" className="mobile-nav-button">
          1
        </button>

        <button type="button" className="mobile-nav-button">
          2
        </button>

        <button type="button" className="mobile-search-button" aria-label="Buscar">
          <span className="css-search-icon" aria-hidden="true" />
        </button>

        <button type="button" className="mobile-nav-button">
          3
        </button>

        <button type="button" className="mobile-nav-button">
          4
        </button>
      </nav>
    </div>
  );
}