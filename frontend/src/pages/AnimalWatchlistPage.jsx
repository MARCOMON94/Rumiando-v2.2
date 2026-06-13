import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { del, get, post, put } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';
import AppModal from '../components/ui/AppModal';

const WATCHLIST_ACTIONS = [
  { key: 'movement', label: 'Movimiento de corral' },
  { key: 'reproductive_status', label: 'Estado reproductivo' },
  { key: 'reproductive_event', label: 'Evento reproductivo' },
  { key: 'health', label: 'Evento sanitario' }
];

const HEALTH_TYPES = [
  ['vaccination', 'Vacunación'],
  ['deworming', 'Desparasitación'],
  ['disease', 'Enfermedad'],
  ['other', 'Otro']
];

const REPRODUCTIVE_EVENTS = [
  { key: 'CUBRICION', label: 'Cubrición' },
  { key: 'INSEMINACION', label: 'Inseminación' },
  { key: 'DIAGNOSTICO_GESTACION', label: 'Diagnóstico de gestación' },
  { key: 'PARTO', label: 'Parto' },
  { key: 'ABORTO', label: 'Aborto' },
  { key: 'SECADO', label: 'Secado' },
  { key: 'BAJA_REPRODUCTIVA', label: 'Baja reproductiva' },
  { key: 'REVISION_REPRODUCTIVA', label: 'Revision reproductiva' }
];

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

function summarizeItems(items) {
  const total = items.length;
  const seenTotal = items.filter((item) => item.seenAt).length;

  return {
    total,
    seenTotal,
    pendingTotal: total - seenTotal
  };
}

function itemReason(item) {
  return item?.motivoTexto || item?.motivoTipo || 'Sin motivo indicado';
}

function itemLocation(item) {
  return item?.animal?.corralActual?.nombre || 'Sin corral';
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function itemName(item, fallback = 'Sin nombre') {
  return item?.nombre || item?.name || item?.codigoRega || fallback;
}

function filterBySpecies(items, animal) {
  const speciesId = Number(animal?.especieId || animal?.especie?.id || 0);
  if (!speciesId) return items || [];

  return (items || []).filter((item) => {
    const itemSpeciesId = Number(item.especieId || item.especie?.id || 0);
    return !itemSpeciesId || itemSpeciesId === speciesId;
  });
}

function dewormingTypeToBackend(value) {
  if (value === 'INTERNA') return 'Interna';
  if (value === 'EXTERNA') return 'Externa';
  if (value === 'MIXTA') return 'Mixta';
  return value || 'Interna';
}

function formatReadInfo(item) {
  if (!item?.lastReadAt) return 'Sin lectura';

  const date = new Date(item.lastReadAt);
  if (Number.isNaN(date.getTime())) return 'Sin lectura';

  return date.toLocaleString();
}

export default function AnimalWatchlistPage() {
  const readerBufferRef = useRef('');
  const readerTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const readerPausedRef = useRef(false);

  const { catalogs, loading: catalogsLoading, error: catalogsError } = useCatalogs();

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, seenTotal: 0, pendingTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flashKey, setFlashKey] = useState(0);
  const [overlayItem, setOverlayItem] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [actionKind, setActionKind] = useState('');
  const [subActionValue, setSubActionValue] = useState('');
  const [healthActionType, setHealthActionType] = useState('vaccination');
  const [healthActionValue, setHealthActionValue] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [pendingRemoveItem, setPendingRemoveItem] = useState(null);
  const readerPaused = Boolean(activeItem || clearConfirmOpen || pendingRemoveItem);

  useEffect(() => {
    readerPausedRef.current = readerPaused;
  }, [readerPaused]);

  const loadItems = useCallback(async function loadItems() {
    setLoading(true);
    setError('');

    try {
      const data = await get('/animal-watchlist');
      const nextItems = Array.isArray(data?.data) ? data.data : [];

      setItems(nextItems);
      setSummary({
        total: data?.total ?? nextItems.length,
        seenTotal: data?.seenTotal ?? nextItems.filter((item) => item.seenAt).length,
        pendingTotal: data?.pendingTotal ?? nextItems.filter((item) => !item.seenAt).length
      });
      window.dispatchEvent(new Event('animal-watchlist:changed'));

      return nextItems;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    return () => {
      window.clearTimeout(readerTimerRef.current);
    };
  }, []);

  const activeAnimal = activeItem?.animal;

  const filteredPens = useMemo(() => {
    if (!activeAnimal?.unidadRegaId) return catalogs.pens || [];

    return (catalogs.pens || []).filter((pen) => {
      return Number(pen.unidadRegaId) === Number(activeAnimal.unidadRegaId);
    });
  }, [catalogs.pens, activeAnimal]);

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  function playAlertSound() {
    const context = ensureAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(720, now);
    oscillator.frequency.setValueAtTime(920, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
  }

  function resetActionPanel(item) {
    setActiveItem(item);
    setActionKind('');
    setSubActionValue('');
    setHealthActionType('vaccination');
    setHealthActionValue('');
    setActionMessage('');
    setActionError('');
  }

  async function finishHitCard() {
    if (actionKind) {
      const saved = await executeSelectedAction(subActionValue);
      if (!saved) return;
    }

    setOverlayItem(null);
    resetActionPanel(null);
    setActionMessage('');
    setActionError('');
  }

  function applyUpdatedItems(updatedItems) {
    const replacements = new Map(updatedItems.map((item) => [item.id, item]));

    setItems((current) => {
      const next = current.map((item) => replacements.get(item.id) || item);
      setSummary(summarizeItems(next));
      return next;
    });
  }

  async function readCode(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return;

    setError('');

    try {
      const result = await post('/animal-watchlist/read', { crotal: code });

      if (!result.matched) {
        return;
      }

      const updatedItems = result.data || [];
      const firstItem = updatedItems[0];

      applyUpdatedItems(updatedItems);
      setOverlayItem(firstItem);
      resetActionPanel(firstItem);
      setFlashKey((current) => current + 1);
      playAlertSound();
    } catch (err) {
      setError(err.message);
    }
  }

  async function processCodes(codes) {
    for (const code of codes) {
      await readCode(code);
    }
  }

  useEffect(() => {
    function stopReaderEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function flushReaderBuffer() {
      const raw = readerBufferRef.current;
      readerBufferRef.current = '';
      window.clearTimeout(readerTimerRef.current);

      if (raw && !readerPausedRef.current) {
        processCodes(extractCodes(raw));
      }
    }

    function handleCaptureKeyDown(event) {
      if (readerPausedRef.current) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const isFinishKey = event.key === 'Enter' || event.key === 'Tab';
      const isCharacter = event.key.length === 1;
      const isBackspace = event.key === 'Backspace';

      if (!isFinishKey && !isCharacter && !isBackspace) return;

      stopReaderEvent(event);

      if (isFinishKey) {
        flushReaderBuffer();
        return;
      }

      if (isBackspace) {
        readerBufferRef.current = readerBufferRef.current.slice(0, -1);
        return;
      }

      readerBufferRef.current += event.key;
      window.clearTimeout(readerTimerRef.current);
      readerTimerRef.current = window.setTimeout(flushReaderBuffer, 140);
    }

    function handleCapturePaste(event) {
      if (readerPausedRef.current) return;

      const pasted = event.clipboardData?.getData('text');
      if (!pasted) return;

      stopReaderEvent(event);
      readerBufferRef.current = '';
      window.clearTimeout(readerTimerRef.current);
      processCodes(extractCodes(pasted));
    }

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    window.addEventListener('paste', handleCapturePaste, true);

    return () => {
      window.removeEventListener('keydown', handleCaptureKeyDown, true);
      window.removeEventListener('paste', handleCapturePaste, true);
      window.clearTimeout(readerTimerRef.current);
    };
  });

  async function removeItem(itemId) {
    setSaving(true);
    setError('');

    try {
      await del(`/animal-watchlist/${itemId}`);
      const nextItems = items.filter((item) => item.id !== itemId);
      setItems(nextItems);
      setSummary(summarizeItems(nextItems));
      window.dispatchEvent(new Event('animal-watchlist:changed'));

      if (activeItem?.id === itemId) {
        resetActionPanel(null);
      }
      if (overlayItem?.id === itemId) {
        setOverlayItem(null);
      }
      setPendingRemoveItem(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearItems() {
    setClearConfirmOpen(true);
  }

  async function confirmRemoveItem() {
    if (!pendingRemoveItem?.id) return;

    await removeItem(pendingRemoveItem.id);
  }

  async function confirmClearItems() {
    setSaving(true);
    setError('');

    try {
      await del('/animal-watchlist');
      setItems([]);
      setSummary({ total: 0, seenTotal: 0, pendingTotal: 0 });
      window.dispatchEvent(new Event('animal-watchlist:changed'));
      setOverlayItem(null);
      resetActionPanel(null);
      setClearConfirmOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleActionKindChange(event) {
    setActionKind(event.target.value);
    setSubActionValue('');
    setHealthActionType('vaccination');
    setHealthActionValue('');
    setActionMessage('');
    setActionError('');
  }

  async function refreshActiveItem() {
    if (!activeItem) return;

    const nextItems = await loadItems();
    const nextActive = nextItems.find((item) => item.id === activeItem.id);
    if (nextActive) {
      setActiveItem(nextActive);
      setOverlayItem(nextActive);
    }
  }

  async function executeSelectedAction(value) {
    if (!activeItem?.animal) return false;

    if (!actionKind) return true;

    if (actionKind !== 'health' && !value) {
      setActionError('Selecciona una opción antes de finalizar.');
      return false;
    }

    if (actionKind === 'health' && healthActionType !== 'other' && !healthActionValue) {
      setActionError('Selecciona una opción sanitaria antes de finalizar.');
      return false;
    }

    const animal = activeItem.animal;
    const today = todayInputValue();
    const reason = itemReason(activeItem);

    setActionSaving(true);
    setActionMessage('');
    setActionError('');

    try {
      if (actionKind === 'movement') {
        const pen = filteredPens.find((item) => String(item.id) === String(value));

        await post('/movements', {
          tipoOperacion: 'INDIVIDUAL',
          motivo: reason === 'Sin motivo indicado' ? 'Búsqueda inteligente' : `Búsqueda inteligente: ${reason}`,
          fecha: today,
          unidadRegaId: Number(animal.unidadRegaId),
          corralDestinoId: Number(value),
          crotales: [animal.crotal],
          aplicarEstadoReproductivo: Boolean(pen?.aplicarEstadoAutomaticamente && pen?.estadoReproductivoSugeridoId),
          estadoReproductivoDestinoId: pen?.estadoReproductivoSugeridoId
            ? Number(pen.estadoReproductivoSugeridoId)
            : null
        });
      } else if (actionKind === 'reproductive_status') {
        await put(`/animals/${animal.id}`, {
          estadoReproductivoId: Number(value),
          fechaEstadoReproductivoActual: today
        });
      } else if (actionKind === 'reproductive_event') {
        await post('/reproductive-events', {
          animalId: animal.id,
          tipoEvento: value,
          resultado: 'NO_APLICA',
          fecha: today,
          observaciones: 'Registrado desde Búsqueda inteligente.'
        });
      } else if (actionKind === 'health') {
        const corralId = animal.corralActualId || animal.corralActual?.id || null;

        if (healthActionType === 'vaccination') {
          const vaccine = (catalogs.vaccines || []).find((item) => String(item.id) === String(healthActionValue));
          await post('/vaccinations', {
            fecha: today,
            vacuna: itemName(vaccine, 'Vacuna registrada desde Búsqueda inteligente'),
            unidadRegaId: Number(animal.unidadRegaId),
            animalId: animal.id,
            corralId
          });
        } else if (healthActionType === 'deworming') {
          const dewormer = (catalogs.dewormers || []).find((item) => String(item.id) === String(healthActionValue));
          await post('/dewormings', {
            fecha: today,
            tipo: dewormingTypeToBackend(dewormer?.tipo),
            producto: itemName(dewormer, 'Desparasitación registrada desde Búsqueda inteligente'),
            unidadRegaId: Number(animal.unidadRegaId),
            animalId: animal.id,
            corralId
          });
        } else {
          const disease = (catalogs.diseases || []).find((item) => String(item.id) === String(healthActionValue));
          await post('/health-cases', {
            fechaInicio: today,
            signosClinicos: healthActionType === 'other'
              ? 'Evento sanitario abierto desde Búsqueda inteligente.'
              : 'Caso abierto desde Búsqueda inteligente.',
            diagnosticoPresuntivo: disease?.nombre || 'Evento sanitario registrado desde Búsqueda inteligente',
            gravedad: disease?.gravedadSugerida || 'MEDIA',
            unidadRegaId: Number(animal.unidadRegaId),
            animalId: animal.id,
            corralId,
            enfermedadId: disease?.id || null
          });
        }
      }

      setActionMessage('Registrado correctamente.');
      await refreshActiveItem();
      return true;
    } catch (err) {
      setActionError(err.message);
      return false;
    } finally {
      setActionSaving(false);
    }
  }

  function handleSubActionChange(event) {
    const value = event.target.value;
    setSubActionValue(value);
    setActionMessage('');
    setActionError('');
  }

  function renderDependentSelect() {
    if (!activeItem || !actionKind) return null;

    if (actionKind === 'movement') {
      return (
        <label>
          Corral destino
          <select value={subActionValue} onChange={handleSubActionChange} disabled={actionSaving}>
            <option value="">Selecciona corral</option>
            {filteredPens.map((pen) => (
              <option key={pen.id} value={pen.id}>
                {itemName(pen)}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (actionKind === 'reproductive_status') {
      return (
        <label>
          Estado destino
          <select value={subActionValue} onChange={handleSubActionChange} disabled={actionSaving}>
            <option value="">Selecciona estado</option>
            {(catalogs.reproductiveStatuses || []).map((status) => (
              <option key={status.id} value={status.id}>
                {itemName(status)}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (actionKind === 'reproductive_event') {
      return (
        <label>
          Evento
          <select value={subActionValue} onChange={handleSubActionChange} disabled={actionSaving}>
            <option value="">Selecciona evento</option>
            {REPRODUCTIVE_EVENTS.map((event) => (
              <option key={event.key} value={event.key}>
                {event.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (actionKind === 'health') {
      const vaccines = filterBySpecies(catalogs.vaccines || [], activeItem?.animal);
      const dewormers = filterBySpecies(catalogs.dewormers || [], activeItem?.animal);
      const diseases = filterBySpecies(catalogs.diseases || [], activeItem?.animal);

      return (
        <>
          <label>
            Tipo sanitario
            <select
              value={healthActionType}
              onChange={(event) => {
                setHealthActionType(event.target.value);
                setHealthActionValue('');
                setActionMessage('');
                setActionError('');
              }}
              disabled={actionSaving}
            >
              {HEALTH_TYPES.map(([optionValue, label]) => (
                <option key={optionValue} value={optionValue}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {healthActionType === 'vaccination' && (
            <label>
              Vacuna
              <select
                value={healthActionValue}
                onChange={(event) => setHealthActionValue(event.target.value)}
                disabled={actionSaving}
              >
                <option value="">Selecciona vacuna</option>
                {vaccines.map((vaccine) => (
                  <option key={vaccine.id} value={vaccine.id}>
                    {itemName(vaccine)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {healthActionType === 'deworming' && (
            <label>
              Desparasitación
              <select
                value={healthActionValue}
                onChange={(event) => setHealthActionValue(event.target.value)}
                disabled={actionSaving}
              >
                <option value="">Selecciona producto</option>
                {dewormers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {itemName(item)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {healthActionType === 'disease' && (
            <label>
              Enfermedad
              <select
                value={healthActionValue}
                onChange={(event) => setHealthActionValue(event.target.value)}
                disabled={actionSaving}
              >
                <option value="">Selecciona enfermedad</option>
                {diseases.map((disease) => (
                  <option key={disease.id} value={disease.id}>
                    {itemName(disease)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      );
    }

    return (
      <label>
        Evento sanitario
        <select value={subActionValue} onChange={handleSubActionChange} disabled={actionSaving}>
          <option value="">Selecciona opción</option>
          <option value="__NO_DISEASE__">Abrir caso sin diagnóstico</option>
          {(catalogs.diseases || []).map((disease) => (
            <option key={disease.id} value={disease.id}>
              {itemName(disease)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section className="page animal-watchlist-page">
      <header className="page-header">
        <div>
          <h2>Búsqueda inteligente</h2>
          <p>Pasa el lector y el móvil te avisará cuando encuentres el animal.</p>
        </div>

        <button type="button" className="secondary" onClick={clearItems} disabled={saving || items.length === 0}>
          Vaciar lista
        </button>
      </header>

      {flashKey > 0 && <span key={flashKey} className="watchlist-screen-flash" aria-hidden="true" />}

      <AppModal
        open={clearConfirmOpen}
        title="Vaciar Búsqueda inteligente"
        description="Se quitarán todos los animales de la lista persistente. Los registros de los animales no se borran."
        onClose={() => {
          if (!saving) setClearConfirmOpen(false);
        }}
      >
        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => setClearConfirmOpen(false)}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="button" onClick={confirmClearItems} disabled={saving}>
            {saving ? 'Vaciando...' : 'Vaciar lista'}
          </button>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(pendingRemoveItem)}
        title="Quitar animal"
        description={`Quitar ${pendingRemoveItem?.animal?.crotal || 'este animal'} de Búsqueda inteligente.`}
        onClose={() => {
          if (!saving) setPendingRemoveItem(null);
        }}
      >
        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => setPendingRemoveItem(null)}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="button" onClick={confirmRemoveItem} disabled={saving}>
            {saving ? 'Quitando...' : 'Quitar'}
          </button>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(overlayItem)}
        title={overlayItem?.animal?.crotal || 'Animal localizado'}
        description={overlayItem ? `${itemLocation(overlayItem)} - ${itemReason(overlayItem)}` : ''}
        onClose={() => {
          if (!actionSaving) {
            setOverlayItem(null);
            resetActionPanel(null);
          }
        }}
      >
        <span className="tag">Localizado</span>

          <div className="watchlist-hit-actions">
            <label>
              Acción posterior
              <select value={actionKind} onChange={handleActionKindChange} disabled={actionSaving}>
                <option value="">Sin acción</option>
                {WATCHLIST_ACTIONS.map((action) => (
                  <option key={action.key} value={action.key}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>

            {renderDependentSelect()}
          </div>

          {actionSaving && <p className="muted">Registrando...</p>}
          {actionMessage && <p className="alert watchlist-inline-alert">{actionMessage}</p>}
          {actionError && <p className="alert error watchlist-inline-alert">Error: {actionError}</p>}

        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (!actionSaving) {
                setOverlayItem(null);
                resetActionPanel(null);
              }
            }}
            disabled={actionSaving}
          >
            Cerrar
          </button>
          <button type="button" onClick={finishHitCard} disabled={actionSaving}>
            {actionSaving ? 'Registrando...' : 'Finalizar'}
          </button>
        </div>
      </AppModal>

      <div className="watchlist-summary-grid">
        <article className="watchlist-summary-card">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="watchlist-summary-card">
          <span>Pendientes</span>
          <strong>{summary.pendingTotal}</strong>
        </article>
        <article className="watchlist-summary-card">
          <span>Vistos</span>
          <strong>{summary.seenTotal}</strong>
        </article>
      </div>

      {catalogsLoading && <p className="muted">Cargando catálogos...</p>}
      {catalogsError && <p className="alert error">Error catálogos: {catalogsError}</p>}
      {error && <p className="alert error">Error: {error}</p>}

      {activeItem && actionKind === '__legacy__' && (
        <section className="panel watchlist-action-panel">
          <div>
            <p className="eyebrow">Animal activado</p>
            <h3>{activeItem.animal?.crotal}</h3>
            <p>{itemLocation(activeItem)} · {itemReason(activeItem)}</p>
          </div>

          <div className="watchlist-action-grid">
            <label>
              Acción
              <select value={actionKind} onChange={handleActionKindChange} disabled={actionSaving}>
                <option value="">Selecciona acción</option>
                {WATCHLIST_ACTIONS.map((action) => (
                  <option key={action.key} value={action.key}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>

            {renderDependentSelect()}
          </div>

          {actionSaving && <p className="muted">Registrando...</p>}
          {actionMessage && <p className="alert">{actionMessage}</p>}
          {actionError && <p className="alert error">Error: {actionError}</p>}
        </section>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Lista</h3>
            <p>Animal, ubicación actual y motivo por el que está marcado.</p>
          </div>
          <button type="button" className="secondary" onClick={loadItems} disabled={loading}>
            Actualizar
          </button>
        </div>

        {loading && <p>Cargando Búsqueda inteligente...</p>}

        {!loading && items.length === 0 && (
          <div className="empty-state">
            <h3>No hay animales marcados</h3>
            <p>Añade animales desde avisos, ficha animal o listado del censo.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="watchlist-table" role="table" aria-label="Búsqueda inteligente">
            <div className="watchlist-table-row watchlist-table-head" role="row">
              <span role="columnheader">Animal</span>
              <span role="columnheader">Ubicación actual</span>
              <span role="columnheader">Motivo</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Acciones</span>
            </div>

            {items.map((item) => (
              <article
                key={item.id}
                className={`watchlist-table-row ${item.seenAt ? 'seen' : ''}`}
                role="row"
              >
                <div role="cell">
                  <strong>{item.animal?.crotal}</strong>
                  <span>{item.animal?.especie?.nombre || 'Sin especie'} - {item.animal?.sexo}</span>
                </div>
                <div role="cell">{itemLocation(item)}</div>
                <div role="cell">{itemReason(item)}</div>
                <div role="cell">
                  <span className={item.seenAt ? 'tag watchlist-seen-tag' : 'tag'}>
                    {item.seenAt ? `Visto ${item.seenCount || 1} vez/veces` : 'Pendiente'}
                  </span>
                  <span className="watchlist-read-info">{formatReadInfo(item)}</span>
                </div>
                <div role="cell" className="watchlist-row-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setOverlayItem(item);
                      resetActionPanel(item);
                    }}
                  >
                    Acción
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setPendingRemoveItem(item)}
                    disabled={saving}
                  >
                    Quitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
