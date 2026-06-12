import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { del, get, post, put } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';

const WATCHLIST_ACTIONS = [
  { key: 'movement', label: 'Movimiento de corral' },
  { key: 'reproductive_status', label: 'Estado reproductivo' },
  { key: 'reproductive_event', label: 'Evento reproductivo' },
  { key: 'health', label: 'Sanitario' }
];

const REPRODUCTIVE_EVENTS = [
  { key: 'CUBRICION', label: 'Cubricion' },
  { key: 'INSEMINACION', label: 'Inseminacion' },
  { key: 'DIAGNOSTICO_GESTACION', label: 'Diagnostico de gestacion' },
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

function formatReadInfo(item) {
  if (!item?.lastReadAt) return 'Sin lectura';

  const date = new Date(item.lastReadAt);
  if (Number.isNaN(date.getTime())) return 'Sin lectura';

  return date.toLocaleString();
}

export default function AnimalWatchlistPage() {
  const inputRef = useRef(null);
  const inputTimerRef = useRef(null);
  const audioContextRef = useRef(null);

  const { catalogs, loading: catalogsLoading, error: catalogsError } = useCatalogs();

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, seenTotal: 0, pendingTotal: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Lector esperando.');
  const [readerActive, setReaderActive] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [overlayItem, setOverlayItem] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [actionKind, setActionKind] = useState('');
  const [subActionValue, setSubActionValue] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

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

  const activateReader = useCallback(function activateReader() {
    setReaderActive(true);
    setStatusText('Lector activo. Pasa crotales de Animal Watchlist.');
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    return () => {
      window.clearTimeout(inputTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading && !activeItem) {
      activateReader();
    }
  }, [loading, activeItem, activateReader]);

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

  function focusReader() {
    activateReader();
    ensureAudioContext();
  }

  function resetActionPanel(item) {
    setActiveItem(item);
    setActionKind('');
    setSubActionValue('');
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
    setStatusText('Lector activo. Pasa crotales de Animal Watchlist.');
    window.setTimeout(() => inputRef.current?.focus(), 0);
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
        setStatusText(`${code} no esta en Animal Watchlist.`);
        return;
      }

      const updatedItems = result.data || [];
      const firstItem = updatedItems[0];

      applyUpdatedItems(updatedItems);
      setOverlayItem(firstItem);
      resetActionPanel(firstItem);
      setFlashKey((current) => current + 1);
      playAlertSound();
      setStatusText(`${firstItem.animal?.crotal || code} localizado.`);
    } catch (err) {
      setError(err.message);
      setStatusText('Error leyendo crotal.');
    }
  }

  async function processCodes(codes) {
    for (const code of codes) {
      await readCode(code);
    }
  }

  function handleReaderInput(event) {
    const target = event.currentTarget;
    window.clearTimeout(inputTimerRef.current);
    inputTimerRef.current = window.setTimeout(() => {
      const codes = extractCodes(target.value);
      target.value = '';
      processCodes(codes);
    }, 140);
  }

  function handleReaderKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    window.clearTimeout(inputTimerRef.current);
    const codes = extractCodes(event.currentTarget.value);
    event.currentTarget.value = '';
    processCodes(codes);
  }

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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearItems() {
    if (!window.confirm('Eliminar toda la Animal Watchlist?')) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      await del('/animal-watchlist');
      setItems([]);
      setSummary({ total: 0, seenTotal: 0, pendingTotal: 0 });
      window.dispatchEvent(new Event('animal-watchlist:changed'));
      setOverlayItem(null);
      resetActionPanel(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleActionKindChange(event) {
    setActionKind(event.target.value);
    setSubActionValue('');
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

    if (!value) {
      setActionError('Selecciona una opcion antes de finalizar.');
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
          motivo: reason === 'Sin motivo indicado' ? 'Animal Watchlist' : `Animal Watchlist: ${reason}`,
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
          observaciones: 'Registrado desde Animal Watchlist.'
        });
      } else if (actionKind === 'health') {
        await post('/health-cases', {
          fechaInicio: today,
          signosClinicos: 'Caso abierto desde Animal Watchlist.',
          gravedad: 'Media',
          unidadRegaId: Number(animal.unidadRegaId),
          animalId: animal.id,
          enfermedadId: value === '__NO_DISEASE__' ? null : Number(value)
        });
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

    return (
      <label>
        Caso sanitario
        <select value={subActionValue} onChange={handleSubActionChange} disabled={actionSaving}>
          <option value="">Selecciona opcion</option>
          <option value="__NO_DISEASE__">Abrir caso sin diagnostico</option>
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
          <p className="eyebrow">Animal Watchlist</p>
          <h2>Animal Watchlist</h2>
          <p>Lista privada de animales a localizar con lector. Los vistos se tachan hasta que los quites.</p>
        </div>

        <button type="button" className="secondary" onClick={clearItems} disabled={saving || items.length === 0}>
          Vaciar lista
        </button>
      </header>

      {flashKey > 0 && <span key={flashKey} className="watchlist-screen-flash" aria-hidden="true" />}

      {overlayItem && (
        <aside className="watchlist-hit-card" aria-live="polite">
          <span className="tag">Localizado</span>
          <h3>{overlayItem.animal?.crotal}</h3>
          <p>{itemLocation(overlayItem)}</p>
          <strong>{itemReason(overlayItem)}</strong>

          <div className="watchlist-hit-actions">
            <label>
              Accion posterior
              <select value={actionKind} onChange={handleActionKindChange} disabled={actionSaving}>
                <option value="">Sin accion</option>
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

          <button type="button" onClick={finishHitCard} disabled={actionSaving}>
            {actionSaving ? 'Registrando...' : 'Finalizar'}
          </button>
        </aside>
      )}

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="metric-card">
          <span>Pendientes</span>
          <strong>{summary.pendingTotal}</strong>
        </article>
        <article className="metric-card">
          <span>Vistos</span>
          <strong>{summary.seenTotal}</strong>
        </article>
        <article className="metric-card">
          <span>Lecturas</span>
          <strong>{items.reduce((total, item) => total + (item.seenCount || 0), 0)}</strong>
        </article>
      </div>

      <section className="reader-panel watchlist-reader-panel">
        <div className="reader-header">
          <div>
            <h3>Lector</h3>
            <p>Pasa o pega crotales. Si estan en Animal Watchlist, avisa y los marca como vistos.</p>
          </div>
        </div>

        <div className="reader-workspace">
          <button type="button" className="reader-visual-button" onClick={focusReader} disabled={loading}>
            <span
              className={`reader-device watchlist-reader-device ${readerActive ? 'active' : ''}`}
              role="img"
              aria-label="Lector RFID"
            >
              <span className="reader-device-top" />
              <span className="reader-device-screen" />
              <span className="reader-device-signal reader-device-signal-left" />
              <span className="reader-device-signal reader-device-signal-right" />
              <span className="reader-device-center" />
              <span className="reader-device-light" />
              <span className="reader-device-dot dot-one" />
              <span className="reader-device-dot dot-two" />
              <span className="reader-device-dot dot-three" />
            </span>
            <span>{loading ? 'Cargando lista...' : statusText}</span>
          </button>

          <input
            ref={inputRef}
            className="reader-hidden-input"
            tabIndex="-1"
            aria-hidden="true"
            onBlur={() => {
              if (!activeItem) {
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
            onChange={handleReaderInput}
            onKeyDown={handleReaderKeyDown}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text');
              if (pasted) {
                event.preventDefault();
                window.clearTimeout(inputTimerRef.current);
                event.currentTarget.value = '';
                processCodes(extractCodes(pasted));
              }
            }}
          />

          <div className="reader-summary">
            <strong>{summary.pendingTotal}</strong>
            <span>pendientes</span>
          </div>
        </div>
      </section>

      {catalogsLoading && <p className="muted">Cargando catalogos...</p>}
      {catalogsError && <p className="alert error">Error catalogos: {catalogsError}</p>}
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
              Accion
              <select value={actionKind} onChange={handleActionKindChange} disabled={actionSaving}>
                <option value="">Selecciona accion</option>
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
            <p>Animal, ubicacion actual y motivo por el que esta marcado.</p>
          </div>
          <button type="button" className="secondary" onClick={loadItems} disabled={loading}>
            Actualizar
          </button>
        </div>

        {loading && <p>Cargando Animal Watchlist...</p>}

        {!loading && items.length === 0 && (
          <div className="empty-state">
            <h3>No hay animales marcados</h3>
            <p>Anade animales desde avisos, ficha animal o listado del censo.</p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="watchlist-table" role="table" aria-label="Animal Watchlist">
            <div className="watchlist-table-row watchlist-table-head" role="row">
              <span role="columnheader">Animal</span>
              <span role="columnheader">Ubicacion actual</span>
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
                    Accion
                  </button>
                  <button type="button" className="secondary" onClick={() => removeItem(item.id)} disabled={saving}>
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
