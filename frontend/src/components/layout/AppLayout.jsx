import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';

function getItems(data, keys) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function extractCodes(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeCode)
    .filter(Boolean);
}

function animalMatchesCode(animal, code) {
  const normalized = normalizeCode(code);

  return [animal?.crotal, animal?.numeroInterno]
    .filter(Boolean)
    .some((value) => normalizeCode(value) === normalized);
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const silentReaderInputRef = useRef(null);
  const silentReaderInputTimerRef = useRef(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [watchlistTotal, setWatchlistTotal] = useState(0);
  const [silentReaderAnimals, setSilentReaderAnimals] = useState([]);
  const [silentReaderLoading, setSilentReaderLoading] = useState(false);

  const isAdmin = user?.rol === 'ADMIN';

  const loadWatchlistCount = useCallback(async function loadWatchlistCount() {
    if (!user) {
      setWatchlistTotal(0);
      return;
    }

    try {
      const data = await get('/animal-watchlist');
      setWatchlistTotal(Number(data?.total || 0));
    } catch {
      setWatchlistTotal(0);
    }
  }, [user]);

  const ensureSilentReaderAnimals = useCallback(async function ensureSilentReaderAnimals() {
    if (silentReaderAnimals.length > 0) {
      return silentReaderAnimals;
    }

    setSilentReaderLoading(true);

    try {
      const data = await get('/animals');
      const animals = getItems(data, ['data', 'animals', 'animales']);
      setSilentReaderAnimals(animals);
      return animals;
    } catch {
      return [];
    } finally {
      setSilentReaderLoading(false);
    }
  }, [silentReaderAnimals]);

  const activateSilentReader = useCallback(function activateSilentReader() {
    if (silentReaderLoading) return;

    ensureSilentReaderAnimals();
    setTimeout(() => silentReaderInputRef.current?.focus(), 0);
  }, [ensureSilentReaderAnimals, silentReaderLoading]);

  useEffect(() => {
    loadWatchlistCount();
  }, [loadWatchlistCount, location.pathname]);

  useEffect(() => {
    window.addEventListener('animal-watchlist:changed', loadWatchlistCount);

    return () => {
      window.removeEventListener('animal-watchlist:changed', loadWatchlistCount);
    };
  }, [loadWatchlistCount]);

  useEffect(() => {
    window.addEventListener('rumiando:silent-reader:activate', activateSilentReader);

    return () => {
      window.removeEventListener('rumiando:silent-reader:activate', activateSilentReader);
    };
  }, [activateSilentReader]);

  useEffect(() => {
    return () => {
      window.clearTimeout(silentReaderInputTimerRef.current);
    };
  }, []);

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

  async function handleSilentReaderCode(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return;

    const animals = await ensureSilentReaderAnimals();
    const animal = animals.find((item) => animalMatchesCode(item, code));

    if (!animal?.id) {
      return;
    }

    closeSettings();
    navigate(`/animals/${animal.id}?preview=1`);
  }

  function handleSilentReaderInput(event) {
    const target = event.currentTarget;

    window.clearTimeout(silentReaderInputTimerRef.current);

    silentReaderInputTimerRef.current = window.setTimeout(() => {
      const codes = extractCodes(target.value);
      target.value = '';
      codes.forEach(handleSilentReaderCode);
    }, 140);
  }

  function handleSilentReaderKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== 'Tab') {
      return;
    }

    event.preventDefault();

    window.clearTimeout(silentReaderInputTimerRef.current);

    const codes = extractCodes(event.currentTarget.value);
    event.currentTarget.value = '';
    codes.forEach(handleSilentReaderCode);
  }

  function handleSilentReaderPaste(event) {
    const pasted = event.clipboardData.getData('text');

    if (!pasted) return;

    event.preventDefault();
    window.clearTimeout(silentReaderInputTimerRef.current);
    event.currentTarget.value = '';

    extractCodes(pasted).forEach(handleSilentReaderCode);
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

          <NavLink to="/animal-watchlist" className="watchlist-nav-link">
            <span>Animal Watchlist</span>
            <span className="watchlist-nav-count">{watchlistTotal}</span>
          </NavLink>

          <NavLink to="/pens">Corrales</NavLink>
          <NavLink to="/health">Sanidad</NavLink>
          <NavLink to="/movements">Movimientos</NavLink>
          <NavLink to="/ai-chat">Asistente IA</NavLink>

          {isAdmin && (
            <NavLink to="/admin/invitations">
              Invitaciones
            </NavLink>
          )}
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

      <input
        ref={silentReaderInputRef}
        className="silent-reader-input"
        tabIndex="-1"
        aria-hidden="true"
        autoComplete="off"
        onChange={handleSilentReaderInput}
        onKeyDown={handleSilentReaderKeyDown}
        onPaste={handleSilentReaderPaste}
      />

      {settingsOpen && (
        <div className="mobile-settings-panel">
          <div>
            <strong>{user?.nombre || user?.email || 'Usuario'}</strong>
            <span>{user?.rol || 'Sesión activa'}</span>
          </div>

          {isAdmin && (
            <NavLink to="/admin/invitations" onClick={closeSettings}>
              Invitaciones
            </NavLink>
          )}

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
        <NavLink
          to="/home"
          className="mobile-nav-button mobile-nav-icon-button"
          aria-label="Inicio"
          onClick={closeSettings}
        >
          <img
            src="/assets/icon-home-green.png"
            alt=""
            aria-hidden="true"
            className="mobile-nav-img mobile-nav-home-img"
          />
        </NavLink>

        <NavLink
          to="/animals/new"
          className="mobile-nav-button mobile-nav-plus"
          aria-label="Añadir animal"
          onClick={closeSettings}
        >
          <span aria-hidden="true">+</span>
        </NavLink>

        <button
          type="button"
          className="mobile-search-button"
          aria-label="Búsqueda por lector"
          onClick={activateSilentReader}
        >
          <img
            src="/assets/icon-lupa-white.png"
            alt=""
            aria-hidden="true"
            className="mobile-search-img"
          />
        </button>

        <NavLink
          to="/reminders"
          className="mobile-nav-button mobile-nav-alert"
          aria-label="Avisos"
          onClick={closeSettings}
        >
          <span aria-hidden="true">!</span>
        </NavLink>

        <NavLink
          to="/ai-chat"
          className="mobile-nav-button mobile-nav-ai"
          aria-label="IA"
          onClick={closeSettings}
        >
          <span aria-hidden="true">IA</span>
        </NavLink>
      </nav>
    </div>
  );
}