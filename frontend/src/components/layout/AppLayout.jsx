import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';

const SILENT_READER_EVENT = 'rumiando:silent-reader:activate';
const SILENT_READER_DEACTIVATE_EVENT = 'rumiando:silent-reader:deactivate';
const VALID_SILENT_ACTIONS = new Set(['lookup', 'parto', 'baja']);
const INITIAL_SILENT_READER = {
  active: false,
  action: 'lookup',
  status: 'idle'
};

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

function routeForSilentAction(action, animalId) {
  if (action === 'parto') return `/birth/new/${animalId}`;
  if (action === 'baja') return `/animals/${animalId}/discharge`;
  return `/animals/${animalId}?preview=1`;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const silentReaderRef = useRef(INITIAL_SILENT_READER);
  const silentReaderBufferRef = useRef('');
  const silentReaderTimerRef = useRef(null);

  const [watchlistTotal, setWatchlistTotal] = useState(0);
  const [automaticAlertsTotal, setAutomaticAlertsTotal] = useState(0);
  const [silentReaderAnimals, setSilentReaderAnimals] = useState([]);
  const [silentReader, setSilentReader] = useState(INITIAL_SILENT_READER);

  const isAdmin = user?.rol === 'ADMIN';

  useEffect(() => {
    silentReaderRef.current = silentReader;
    window.dispatchEvent(new CustomEvent('rumiando:silent-reader:state', {
      detail: silentReader
    }));
  }, [silentReader]);

  useEffect(() => {
    setSilentReaderAnimals([]);
  }, [user?.id]);

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

  const loadAutomaticAlertsCount = useCallback(async function loadAutomaticAlertsCount() {
    if (!user) {
      setAutomaticAlertsTotal(0);
      return;
    }

    try {
      const data = await get('/automation/daily-operational-summary/app');
      const automaticAlerts = data?.automaticAlerts || {};
      const items = Array.isArray(automaticAlerts.items) ? automaticAlerts.items : [];
      setAutomaticAlertsTotal(Number(automaticAlerts.total ?? items.length ?? 0));
    } catch {
      setAutomaticAlertsTotal(0);
    }
  }, [user]);

  const ensureSilentReaderAnimals = useCallback(async function ensureSilentReaderAnimals() {
    if (silentReaderAnimals.length > 0) {
      return silentReaderAnimals;
    }

    setSilentReader((current) => (
      current.active ? { ...current, status: 'loading' } : current
    ));

    try {
      const data = await get('/animals');
      const animals = getItems(data, ['data', 'animals', 'animales']);
      setSilentReaderAnimals(animals);
      return animals;
    } catch {
      return [];
    } finally {
      setSilentReader((current) => (
        current.active ? { ...current, status: 'active' } : current
      ));
    }
  }, [silentReaderAnimals]);

  const deactivateSilentReader = useCallback(function deactivateSilentReader() {
    window.clearTimeout(silentReaderTimerRef.current);
    silentReaderBufferRef.current = '';
    silentReaderRef.current = INITIAL_SILENT_READER;
    setSilentReader(INITIAL_SILENT_READER);
  }, []);

  const activateSilentReader = useCallback(function activateSilentReader(action = 'lookup') {
    const nextAction = VALID_SILENT_ACTIONS.has(action) ? action : 'lookup';
    const nextReader = {
      active: true,
      action: nextAction,
      status: 'loading'
    };

    window.clearTimeout(silentReaderTimerRef.current);
    silentReaderBufferRef.current = '';
    silentReaderRef.current = nextReader;
    setSilentReader(nextReader);

    ensureSilentReaderAnimals();
  }, [ensureSilentReaderAnimals]);

  const processSilentReaderCodes = useCallback(async function processSilentReaderCodes(rawCodes) {
    const codes = Array.isArray(rawCodes) ? rawCodes.map(normalizeCode).filter(Boolean) : extractCodes(rawCodes);

    if (!codes.length || !silentReaderRef.current.active) {
      return false;
    }

    setSilentReader((current) => (
      current.active ? { ...current, status: 'loading' } : current
    ));

    const animals = await ensureSilentReaderAnimals();
    const animal = codes
      .map((code) => animals.find((item) => animalMatchesCode(item, code)))
      .find(Boolean);

    if (!animal?.id) {
      setSilentReader((current) => (
        current.active ? { ...current, status: 'active' } : current
      ));
      return false;
    }

    const action = silentReaderRef.current.action || 'lookup';
    const returnTo = `${location.pathname}${location.search || ''}${location.hash || ''}`;
    const state = {
      openedBySilentReader: true,
      returnTo,
      silentAction: action
    };

    deactivateSilentReader();
    navigate(routeForSilentAction(action, animal.id), { state });
    return true;
  }, [
    deactivateSilentReader,
    ensureSilentReaderAnimals,
    location.hash,
    location.pathname,
    location.search,
    navigate
  ]);

  useEffect(() => {
    loadWatchlistCount();
  }, [loadWatchlistCount, location.pathname]);

  useEffect(() => {
    loadAutomaticAlertsCount();
  }, [loadAutomaticAlertsCount, location.pathname]);

  useEffect(() => {
    window.addEventListener('animal-watchlist:changed', loadWatchlistCount);

    return () => {
      window.removeEventListener('animal-watchlist:changed', loadWatchlistCount);
    };
  }, [loadWatchlistCount]);

  useEffect(() => {
    function handleActivateSilentReader(event) {
      activateSilentReader(event.detail?.action || 'lookup');
    }

    function handleDeactivateSilentReader() {
      deactivateSilentReader();
    }

    window.addEventListener(SILENT_READER_EVENT, handleActivateSilentReader);
    window.addEventListener(SILENT_READER_DEACTIVATE_EVENT, handleDeactivateSilentReader);

    return () => {
      window.removeEventListener(SILENT_READER_EVENT, handleActivateSilentReader);
      window.removeEventListener(SILENT_READER_DEACTIVATE_EVENT, handleDeactivateSilentReader);
    };
  }, [activateSilentReader, deactivateSilentReader]);

  useEffect(() => {
    function stopReaderEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function flushBuffer() {
      const raw = silentReaderBufferRef.current;
      silentReaderBufferRef.current = '';
      window.clearTimeout(silentReaderTimerRef.current);

      if (raw) {
        processSilentReaderCodes(extractCodes(raw));
      }
    }

    function handleCaptureKeyDown(event) {
      if (!silentReaderRef.current.active) return;

      if (event.key === 'Escape') {
        stopReaderEvent(event);
        deactivateSilentReader();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const isFinishKey = event.key === 'Enter' || event.key === 'Tab';
      const isCharacter = event.key.length === 1;
      const isBackspace = event.key === 'Backspace';

      if (!isFinishKey && !isCharacter && !isBackspace) return;

      stopReaderEvent(event);

      if (isFinishKey) {
        flushBuffer();
        return;
      }

      if (isBackspace) {
        silentReaderBufferRef.current = silentReaderBufferRef.current.slice(0, -1);
        return;
      }

      silentReaderBufferRef.current += event.key;
      window.clearTimeout(silentReaderTimerRef.current);
      silentReaderTimerRef.current = window.setTimeout(flushBuffer, 160);
    }

    function handleCapturePaste(event) {
      if (!silentReaderRef.current.active) return;

      const pasted = event.clipboardData?.getData('text');
      if (!pasted) return;

      stopReaderEvent(event);
      silentReaderBufferRef.current = '';
      window.clearTimeout(silentReaderTimerRef.current);
      processSilentReaderCodes(extractCodes(pasted));
    }

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    window.addEventListener('paste', handleCapturePaste, true);

    return () => {
      window.removeEventListener('keydown', handleCaptureKeyDown, true);
      window.removeEventListener('paste', handleCapturePaste, true);
      window.clearTimeout(silentReaderTimerRef.current);
    };
  }, [deactivateSilentReader, processSilentReaderCodes]);

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
            <span>Búsqueda inteligente</span>
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

      <nav className="mobile-bottom-nav" aria-label="Navegación principal móvil">
        <NavLink
          to="/home"
          className="mobile-nav-button mobile-nav-icon-button"
          aria-label="Inicio"
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
        >
          <img
            src="/assets/icon-add-green.png"
            alt=""
            aria-hidden="true"
            className="mobile-nav-img mobile-nav-action-img"
          />
        </NavLink>

        <button
          type="button"
          className={`mobile-search-button ${silentReader.active ? 'reading active' : ''}`}
          aria-label="Búsqueda por lector"
          aria-pressed={silentReader.active}
          onClick={() => (
            silentReader.active ? deactivateSilentReader() : activateSilentReader('lookup')
          )}
        >
          <span className="mobile-search-spinner" aria-hidden="true" />
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
        >
          <span className="mobile-nav-badge-wrap">
            <img
              src="/assets/icon-cencerro-green.png"
              alt=""
              aria-hidden="true"
              className="mobile-nav-img mobile-nav-action-img"
            />
            {automaticAlertsTotal > 0 && (
              <span className="mobile-nav-badge" aria-label={`${automaticAlertsTotal} avisos`}>
                {automaticAlertsTotal > 99 ? '99+' : automaticAlertsTotal}
              </span>
            )}
          </span>
        </NavLink>

        <NavLink
          to="/ai-chat"
          className="mobile-nav-button mobile-nav-ai"
          aria-label="IA"
        >
          <img
            src="/assets/icon-ia-green.png"
            alt=""
            aria-hidden="true"
            className="mobile-nav-img mobile-nav-action-img"
          />
        </NavLink>
      </nav>
    </div>
  );
}
