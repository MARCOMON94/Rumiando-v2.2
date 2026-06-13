import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import AppModal from '../components/ui/AppModal';
import ManagementRulesPanel from '../components/settings/ManagementRulesPanel';
import PensSettingsPanel from '../components/settings/PensSettingsPanel';
import FarmAccountSettingsPanel from '../components/settings/FarmAccountSettingsPanel';
import UserSettingsPanel from '../components/settings/UserSettingsPanel';

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

const ALERT_PRESETS = {
  ovino: {
    breedingAfterProduction: 150,
    pregnancyDiagnosis: 45,
    dryOff: 210,
    noBirth: 365,
    expectedGestation: 147
  },
  caprino: {
    breedingAfterProduction: 150,
    pregnancyDiagnosis: 45,
    dryOff: 210,
    noBirth: 365,
    expectedGestation: 150
  }
};

const ALERT_CONFIG_ROWS = [
  {
    key: 'pregnancyDiagnosis',
    label: 'Diagnóstico de gestación',
    suffix: 'días desde cubrición/inseminación'
  },
  {
    key: 'breedingAfterProduction',
    label: 'Cubrición recomendable',
    suffix: 'días desde entrada en producción'
  },
  {
    key: 'dryOff',
    label: 'Paso a seca',
    suffix: 'días desde estado gestante'
  },
  {
    key: 'noBirth',
    label: 'Sin parto registrado',
    suffix: 'días desde el último parto'
  },
  {
    key: 'expectedGestation',
    label: 'Gestación orientativa',
    suffix: 'días para estimar parto'
  }
];

function getInitialTheme() {
  const storedTheme = window.localStorage.getItem('rumiando-theme');
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getAlertConfigStorageKey(user, farmUnitId) {
  return `rumiando-alert-config:${user?.cuentaGanaderaId || 'account'}:${farmUnitId || 'default'}`;
}

function createAlertConfig(preset = 'ovino') {
  const values = ALERT_PRESETS[preset] || ALERT_PRESETS.ovino;

  return {
    preset,
    values: { ...values }
  };
}

function activateSilentReader(action = 'lookup') {
  window.dispatchEvent(new CustomEvent('rumiando:silent-reader:activate', {
    detail: { action }
  }));
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
  const [theme, setTheme] = useState(getInitialTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('main');
  const [farmUnits, setFarmUnits] = useState([]);
  const [selectedAlertUnitId, setSelectedAlertUnitId] = useState('');
  const [alertConfig, setAlertConfig] = useState(() => createAlertConfig('ovino'));
  const [alertConfigMessage, setAlertConfigMessage] = useState('');

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('rumiando-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen || !isAdmin || farmUnits.length > 0) return;

    async function loadFarmUnits() {
      try {
        const data = await get('/catalogs');
        const units = Array.isArray(data?.farmUnits) ? data.farmUnits : [];
        setFarmUnits(units);
        setSelectedAlertUnitId((current) => current || String(units[0]?.id || 'default'));
      } catch {
        setFarmUnits([]);
        setSelectedAlertUnitId('default');
      }
    }

    loadFarmUnits();
  }, [settingsOpen, isAdmin, farmUnits.length]);

  useEffect(() => {
    if (!settingsOpen || !isAdmin || !selectedAlertUnitId) return;

    const saved = window.localStorage.getItem(getAlertConfigStorageKey(user, selectedAlertUnitId));

    if (saved) {
      try {
        setAlertConfig(JSON.parse(saved));
        return;
      } catch {
        // Si el guardado local está corrupto, se vuelve al preset seguro.
      }
    }

    setAlertConfig(createAlertConfig('ovino'));
  }, [settingsOpen, isAdmin, selectedAlertUnitId, user]);

  function toggleSilentReader() {
    activateSilentReader('lookup');
  }

  function closeSettings() {
    if (settingsView !== 'main') {
      setSettingsView('main');
      setAlertConfigMessage('');
      return;
    }

    setSettingsOpen(false);
    setSettingsView('main');
    setAlertConfigMessage('');
  }

  function applyAlertPreset(preset) {
    if (preset === 'personalizada') {
      setAlertConfig((current) => ({
        ...current,
        preset: 'personalizada'
      }));
      setAlertConfigMessage('');
      return;
    }

    setAlertConfig(createAlertConfig(preset));
    setAlertConfigMessage('');
  }

  function updateAlertConfigValue(key, value) {
    setAlertConfig((current) => ({
      preset: 'personalizada',
      values: {
        ...current.values,
        [key]: value
      }
    }));
    setAlertConfigMessage('');
  }

  function saveAlertConfig() {
    window.localStorage.setItem(
      getAlertConfigStorageKey(user, selectedAlertUnitId),
      JSON.stringify(alertConfig)
    );
    setAlertConfigMessage('Configuración guardada en este dispositivo.');
  }

  function renderSettingsMain() {
    return (
      <div className="home-settings-actions">
        <section className="settings-theme-section" aria-label="Modo de color">
          <span>Modo de color</span>
          <div className="theme-toggle" role="group" aria-label="Seleccionar modo de color">
            <button
              type="button"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              Claro
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              Oscuro
            </button>
          </div>
        </section>

        {isAdmin && (
          <>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                closeSettings();
                navigate('/admin/invitations');
              }}
            >
              Invitaciones
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSettingsView('alerts')}
            >
              Avisos
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSettingsView('automation')}
            >
              Automatización
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSettingsView('pens')}
            >
              Corrales
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSettingsView('account')}
            >
              Cuenta ganadera
            </button>
          </>
        )}

        <button
          type="button"
          className="secondary"
          onClick={() => setSettingsView('user')}
        >
          Usuario
        </button>

        <button
          type="button"
          onClick={() => {
            closeSettings();
            logout();
          }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  function renderAlertSettings() {
    return (
      <div className="settings-alert-config">
        <label>
          Unidad REGA
          <select
            value={selectedAlertUnitId}
            onChange={(event) => setSelectedAlertUnitId(event.target.value)}
          >
            {farmUnits.length === 0 && <option value="default">Explotación</option>}
            {farmUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.nombre || unit.codigoRega || `REGA ${unit.id}`}
              </option>
            ))}
          </select>
        </label>

        <section className="settings-theme-section" aria-label="Perfil de avisos">
          <span>Perfil de avisos</span>
          <div className="alert-preset-toggle" role="group" aria-label="Seleccionar perfil">
            <button
              type="button"
              className={alertConfig.preset === 'ovino' ? 'active' : ''}
              onClick={() => applyAlertPreset('ovino')}
            >
              Ovino
            </button>
            <button
              type="button"
              className={alertConfig.preset === 'caprino' ? 'active' : ''}
              onClick={() => applyAlertPreset('caprino')}
            >
              Caprino
            </button>
            <button
              type="button"
              className={alertConfig.preset === 'personalizada' ? 'active' : ''}
              onClick={() => applyAlertPreset('personalizada')}
            >
              Personalizada
            </button>
          </div>
        </section>

        <div className="alert-config-rows">
          {ALERT_CONFIG_ROWS.map((row) => (
            <label className="alert-config-row" key={row.key}>
              <span>{row.label}</span>
              <span className="alert-config-input-line">
                <input
                  type="number"
                  min="1"
                  value={alertConfig.values[row.key] ?? ''}
                  onChange={(event) => updateAlertConfigValue(row.key, event.target.value)}
                />
                <small>{row.suffix}</small>
              </span>
            </label>
          ))}
        </div>

        {alertConfigMessage && <p className="alert">{alertConfigMessage}</p>}

        <button type="button" onClick={saveAlertConfig}>
          Guardar avisos
        </button>
      </div>
    );
  }

  function settingsTitle() {
    if (settingsView === 'alerts') return 'Avisos';
    if (settingsView === 'automation') return 'Automatización';
    if (settingsView === 'pens') return 'Corrales';
    if (settingsView === 'account') return 'Cuenta ganadera';
    if (settingsView === 'user') return 'Usuario';
    return 'Configuración';
  }

  function settingsDescription() {
    if (settingsView === 'alerts') return 'Ajustes orientativos por REGA.';
    if (settingsView === 'automation') return 'Reglas de manejo entre corrales y reproducción.';
    if (settingsView === 'pens') return 'Edita corrales y traslados seguros.';
    if (settingsView === 'account') return 'Datos de explotación, REGAs y usuarios.';
    if (settingsView === 'user') return 'Tus datos visibles en la app.';
    return user?.nombre || user?.email || 'Sesión activa';
  }

  function renderSettingsContent() {
    if (settingsView === 'alerts') return renderAlertSettings();
    if (settingsView === 'automation') {
      return <ManagementRulesPanel />;
    }
    if (settingsView === 'pens') {
      return <PensSettingsPanel />;
    }
    if (settingsView === 'account') {
      return (
        <FarmAccountSettingsPanel
          currentUser={user}
        />
      );
    }
    if (settingsView === 'user') {
      return <UserSettingsPanel />;
    }

    return renderSettingsMain();
  }

  return (
    <section className="clean-home-page field-home-page">
      <div className="field-home-search-row">
        <button
          type="button"
          className={`field-crotal-search-button ${silentReader.active ? 'reading active' : ''} silent-mode-${silentReader.action}`}
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
          className={`field-operation-button ${silentReader.active && silentReader.action === 'parto' ? 'active' : ''}`}
          onClick={() => activateSilentReader('parto')}
        >
          <span>Parto</span>
        </button>

        <button
          type="button"
          className={`field-operation-button ${silentReader.active && silentReader.action === 'baja' ? 'active' : ''}`}
          onClick={() => activateSilentReader('baja')}
        >
          <span>Baja</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/operations/movement')}
        >
          <span>Movimiento de corral</span>
          <OperationIcon src={HOME_ICONS.add} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/operations/reproductive')}
        >
          <span>Estado reproductivo</span>
          <OperationIcon src={HOME_ICONS.add} />
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-with-icon"
          onClick={() => navigate('/operations/health')}
        >
          <span>Evento sanitario</span>
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
        title={settingsTitle()}
        description={settingsDescription()}
        onClose={closeSettings}
        modalClassName="settings-modal"
      >
        {renderSettingsContent()}
      </AppModal>
    </section>
  );
}
