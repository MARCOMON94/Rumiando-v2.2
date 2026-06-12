import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import AppModal from '../components/ui/AppModal';

const INITIAL_SILENT_READER = {
  active: false,
  action: 'lookup',
  status: 'idle'
};

const HOME_ICONS = {
  add: '/assets/icon-add-green.png',
  alerts: '/assets/icon-cencerro-green.png',
  ai: '/assets/icon-ia-green.png',
  search: '/assets/icon-lupa-white.png',
  census: '/assets/icon-ganado-outline-green.png',
  stats: '/assets/icon-estadisticas-green.png',
  settings: '/assets/icon-settings-green.png'
};

function activateSilentReader(action = 'lookup') {
  window.dispatchEvent(new CustomEvent('rumiando:silent-reader:activate', {
    detail: { action }
  }));
}

function deactivateSilentReader() {
  window.dispatchEvent(new Event('rumiando:silent-reader:deactivate'));
}

function OperationIcon({ src }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="field-operation-icon"
    />
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const [watchlistTotal, setWatchlistTotal] = useState(0);
  const [silentReader, setSilentReader] = useState(INITIAL_SILENT_READER);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isAdmin = user?.rol === 'ADMIN';

  const loadWatchlistCount = useCallback(async function loadWatchlistCount() {
    try {
      const data = await get('/animal-watchlist');
      setWatchlistTotal(Number(data?.total || 0));
    } catch {
      setWatchlistTotal(0);
    }
  }, []);

  useEffect(() => {
    loadWatchlistCount();
  }, [loadWatchlistCount]);

  useEffect(() => {
    window.addEventListener('animal-watchlist:changed', loadWatchlistCount);

    return () => {
      window.removeEventListener('animal-watchlist:changed', loadWatchlistCount);
    };
  }, [loadWatchlistCount]);

  useEffect(() => {
    function handleSilentReaderState(event) {
      setSilentReader(event.detail || INITIAL_SILENT_READER);
    }

    window.addEventListener('rumiando:silent-reader:state', handleSilentReaderState);

    return () => {
      window.removeEventListener('rumiando:silent-reader:state', handleSilentReaderState);
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('reader') === '1') {
      activateSilentReader('lookup');
    }
  }, [searchParams]);

  function toggleSilentReader() {
    if (silentReader.active) {
      deactivateSilentReader();
      return;
    }

    activateSilentReader('lookup');
  }

  return (
    <section className="clean-home-page field-home-page">
      <div className="field-home-search-row">
        <button
          type="button"
          className={`field-crotal-search-button ${silentReader.active ? 'reading active' : ''}`}
          aria-pressed={silentReader.active}
          onClick={toggleSilentReader}
        >
          <span>Buscar crotal</span>
          <span className="field-crotal-search-icon-wrap" aria-hidden="true">
            <span className="field-crotal-search-spinner" />
            <img src={HOME_ICONS.search} alt="" />
          </span>
        </button>
      </div>

      <div className="field-operation-grid field-operation-grid-custom" aria-label="Operaciones principales">
        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-live"
          onClick={() => navigate('/animal-watchlist')}
        >
          <span>Búsqueda inteligente</span>

          <span className="field-watchlist-pill" aria-label={`${watchlistTotal} animales en Búsqueda inteligente`}>
            <img
              src="/assets/rumiando-sheep-facing-left.png"
              alt=""
              aria-hidden="true"
            />
            {watchlistTotal > 0 && (
              <span className="field-watchlist-badge" aria-hidden="true">
                {watchlistTotal > 99 ? '99+' : watchlistTotal}
              </span>
            )}
          </span>
        </button>

        <button
          type="button"
          className="field-operation-button"
          onClick={() => activateSilentReader('parto')}
        >
          <span>Parto</span>
        </button>

        <button
          type="button"
          className="field-operation-button"
          onClick={() => activateSilentReader('baja')}
        >
          <span>Baja</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/movements')}
        >
          <span>Movimiento de corral</span>
          <OperationIcon src={HOME_ICONS.add} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/animals')}
        >
          <span>Estado reproductivo</span>
          <OperationIcon src={HOME_ICONS.add} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/health')}
        >
          <span>Caso sanitario</span>
          <OperationIcon src={HOME_ICONS.add} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/animals')}
        >
          <span>Censo</span>
          <OperationIcon src={HOME_ICONS.census} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/dashboard')}
        >
          <span>Estadísticas</span>
          <OperationIcon src={HOME_ICONS.stats} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/reminders')}
        >
          <span>Alertas</span>
          <OperationIcon src={HOME_ICONS.alerts} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/ai-chat')}
        >
          <span>Asistente IA</span>
          <OperationIcon src={HOME_ICONS.ai} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-settings field-operation-with-icon"
          onClick={() => setSettingsOpen(true)}
        >
          <span>Configuración</span>
          <OperationIcon src={HOME_ICONS.settings} />
        </button>
      </div>

      <AppModal
        open={settingsOpen}
        title="Configuración"
        description={user?.nombre || user?.email || 'Sesión activa'}
        onClose={() => setSettingsOpen(false)}
      >
        <div className="home-settings-actions">
          {isAdmin && (
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSettingsOpen(false);
                  navigate('/admin/invitations');
                }}
              >
                Invitaciones
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSettingsOpen(false);
                  navigate('/automation');
                }}
              >
                Automatización
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              logout();
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </AppModal>
    </section>
  );
}
