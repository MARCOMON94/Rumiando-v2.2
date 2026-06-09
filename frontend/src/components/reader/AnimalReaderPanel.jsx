import { useEffect, useMemo, useRef, useState } from 'react';
import { get } from '../../api/apiClient';

const MODES = [
  { key: 'unitario', label: 'Unitario' },
  { key: 'lote', label: 'Lote' },
  { key: 'corral', label: 'Corral' }
];

const ACTIONS = [
  { key: 'cambio_corral', label: 'Cambio de corral' },
  { key: 'sanidad', label: 'Caso sanitario' },
  { key: 'tratamiento', label: 'Tratamiento' },
  { key: 'vacunacion', label: 'Vacunacion' },
  { key: 'desparasitacion', label: 'Desparasitacion' },
  { key: 'reproduccion', label: 'Evento reproductivo' },
  { key: 'baja_muerte', label: 'Baja por muerte' }
];

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

function animalPenName(animal) {
  return animal?.corralActual?.nombre || animal?.corralActual?.name || 'Sin corral';
}

function animalSpeciesName(animal) {
  return animal?.especie?.nombre || animal?.especie?.name || 'Sin especie';
}

function actionFromRequest(request) {
  const actionType = request?.actionType || request?.action_type || request?.data?.action_type;
  if (actionType === 'ANIMAL_DISCHARGE') return 'baja_muerte';
  if (actionType === 'CHANGE_PEN') return 'cambio_corral';
  if (['CREATE_HEALTH_CASE', 'UPDATE_HEALTH_CASE'].includes(actionType)) return 'sanidad';
  if (['CREATE_TREATMENT', 'UPDATE_TREATMENT'].includes(actionType)) return 'tratamiento';
  if (['CREATE_VACCINATION', 'UPDATE_VACCINATION'].includes(actionType)) return 'vacunacion';
  if (['CREATE_DEWORMING', 'UPDATE_DEWORMING'].includes(actionType)) return 'desparasitacion';
  if (['CREATE_REPRODUCTIVE_EVENT', 'UPDATE_REPRODUCTIVE_EVENT'].includes(actionType)) return 'reproduccion';
  return 'cambio_corral';
}

function modeFromRequest(request, fallback) {
  const actionType = request?.actionType || request?.action_type || request?.data?.action_type;
  const requestText = String(request?.originalMessage || request?.original_message || request?.data?.original_message || '').toLowerCase();
  const preferredMode = request?.preferredMode || request?.preferred_mode || request?.data?.draft?.preferred_mode;
  if (preferredMode) return preferredMode;
  if (actionType === 'ANIMAL_DISCHARGE') return 'unitario';
  if (requestText.includes('corral completo') || requestText.includes('todo el corral') || requestText.includes('por corral')) {
    return 'corral';
  }
  return fallback;
}

export default function AnimalReaderPanel({
  title = 'Lectura de animales',
  subtitle = 'Activa el lector y pasa crotales. Los repetidos se ignoran.',
  animals: providedAnimals,
  pens: providedPens,
  initialMode = 'lote',
  actionRequest = null,
  compact = false,
  onFinish
}) {
  const readerInputRef = useRef(null);
  const flashTimerRef = useRef(null);
  const inputTimerRef = useRef(null);

  const [loadedAnimals, setLoadedAnimals] = useState([]);
  const [loadedPens, setLoadedPens] = useState([]);
  const [loading, setLoading] = useState(!providedAnimals);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(modeFromRequest(actionRequest, initialMode));
  const [actionKind, setActionKind] = useState(actionFromRequest(actionRequest));
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [unknownCodes, setUnknownCodes] = useState([]);
  const [selectedPenIds, setSelectedPenIds] = useState([]);
  const [readerActive, setReaderActive] = useState(false);
  const [readerFlash, setReaderFlash] = useState(false);
  const [statusText, setStatusText] = useState('Lector esperando.');
  const [lastDraft, setLastDraft] = useState(null);

  const animals = providedAnimals || loadedAnimals;
  const pens = providedPens || loadedPens;

  useEffect(() => {
    setMode(modeFromRequest(actionRequest, initialMode));
    setActionKind(actionFromRequest(actionRequest));
  }, [actionRequest, initialMode]);

  useEffect(() => {
    return () => {
      window.clearTimeout(flashTimerRef.current);
      window.clearTimeout(inputTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (providedAnimals && providedPens) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');

      try {
        const [animalsData, pensData] = await Promise.all([
          providedAnimals ? Promise.resolve(providedAnimals) : get('/animals'),
          providedPens ? Promise.resolve(providedPens) : get('/pens')
        ]);

        if (cancelled) return;

        if (!providedAnimals) {
          setLoadedAnimals(getItems(animalsData, ['data', 'animals', 'animales']));
        }
        if (!providedPens) {
          setLoadedPens(getItems(pensData, ['data', 'pens', 'corrales']));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [providedAnimals, providedPens]);

  const selectedCodes = useMemo(() => {
    return new Set(selectedAnimals.map((animal) => normalizeCode(animal.crotal || animal.numeroInterno)));
  }, [selectedAnimals]);

  const unknownCodeSet = useMemo(() => {
    return new Set(unknownCodes.map((item) => normalizeCode(item.code)));
  }, [unknownCodes]);

  function focusReader() {
    setReaderActive(true);
    setStatusText(mode === 'corral' ? 'Selecciona corrales o pasa lector si lo necesitas.' : 'Lector activo.');
    setTimeout(() => readerInputRef.current?.focus(), 0);
  }

  function flashReader(text) {
    setReaderFlash(true);
    setStatusText(text);
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setReaderFlash(false);
    }, 1000);
  }

  function addCode(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) return;

    if (mode === 'corral') {
      flashReader('Lectura recibida. En modo corral se trabaja por corrales completos.');
      return;
    }

    const animal = animals.find((item) => animalMatchesCode(item, code));

    if (!animal) {
      if (!unknownCodeSet.has(code)) {
        setUnknownCodes((current) => {
          if (current.some((item) => normalizeCode(item.code) === code)) {
            return current;
          }
          return [...current, { code, readAt: Date.now() }];
        });
      }
      flashReader(`${code} no esta registrado.`);
      return;
    }

    const animalCode = normalizeCode(animal.crotal || animal.numeroInterno);
    if (selectedCodes.has(animalCode)) {
      flashReader(`${animal.crotal} ya estaba en la lista.`);
      return;
    }

    if (mode === 'unitario') {
      setSelectedAnimals([animal]);
      setUnknownCodes([]);
      flashReader(`${animal.crotal} listo.`);
      return;
    }

    setSelectedAnimals((current) => {
      if (current.some((item) => animalMatchesCode(item, animalCode))) {
        return current;
      }
      return [...current, animal];
    });
    flashReader(`${animal.crotal} anadido.`);
  }

  function handleReaderInput(event) {
    const target = event.currentTarget;
    window.clearTimeout(inputTimerRef.current);
    inputTimerRef.current = window.setTimeout(() => {
      const codes = extractCodes(target.value);
      target.value = '';
      codes.forEach(addCode);
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
    codes.forEach(addCode);
  }

  function removeAnimal(animalId) {
    setSelectedAnimals((current) => current.filter((animal) => animal.id !== animalId));
  }

  function togglePen(penId) {
    setSelectedPenIds((current) => {
      if (current.includes(penId)) {
        return current.filter((id) => id !== penId);
      }
      return [...current, penId];
    });
  }

  function resetSession(nextMode = mode) {
    setSelectedAnimals([]);
    setUnknownCodes([]);
    setSelectedPenIds([]);
    setLastDraft(null);
    setMode(nextMode);
    setStatusText('Lector esperando.');
    setTimeout(() => readerInputRef.current?.focus(), 0);
  }

  function finishSession() {
    const selectedPenIdSet = new Set(selectedPenIds.map((id) => String(id)));
    const selectedPens = pens.filter((pen) => selectedPenIdSet.has(String(pen.id)));
    const draftAnimals = mode === 'corral'
      ? animals.filter((animal) => selectedPenIdSet.has(String(animal?.corralActual?.id)))
      : selectedAnimals;

    const draft = {
      mode,
      actionKind,
      animals: draftAnimals,
      unknownCodes,
      pens: selectedPens,
      createdAt: new Date().toISOString()
    };

    setLastDraft(draft);
    setStatusText('Borrador preparado.');
    onFinish?.(draft);
  }

  const canFinish = mode === 'corral'
    ? selectedPenIds.length > 0
    : selectedAnimals.length > 0 || unknownCodes.length > 0;

  return (
    <section className={`reader-panel ${compact ? 'compact' : ''}`}>
      <div className="reader-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        <label className="reader-action-select">
          Tipo
          <select value={actionKind} onChange={(event) => setActionKind(event.target.value)}>
            {ACTIONS.map((action) => (
              <option key={action.key} value={action.key}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="reader-tabs" role="tablist" aria-label="Modo de lectura">
        {MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={mode === item.key ? 'active' : ''}
            onClick={() => resetSession(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="alert error">Error lector: {error}</p>}

      <div className="reader-workspace">
        <button
          type="button"
          className="reader-visual-button"
          onClick={focusReader}
          disabled={loading}
        >
          <span
            className={`reader-device ${readerFlash ? 'success' : ''} ${readerActive ? 'active' : ''}`}
            role="img"
            aria-label="Lector RFID"
          >
            <span className="reader-device-screen" />
            <span className="reader-device-light" />
          </span>
          <span>{loading ? 'Cargando animales...' : statusText}</span>
        </button>

        <input
          ref={readerInputRef}
          className="reader-hidden-input"
          tabIndex="-1"
          aria-hidden="true"
          onChange={handleReaderInput}
          onKeyDown={handleReaderKeyDown}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (pasted) {
              event.preventDefault();
              window.clearTimeout(inputTimerRef.current);
              event.currentTarget.value = '';
              extractCodes(pasted).forEach(addCode);
            }
          }}
        />

        {mode !== 'corral' && (
          <div className="reader-summary">
            <strong>{selectedAnimals.length}</strong>
            <span>{mode === 'unitario' ? 'animal seleccionado' : 'animales en lote'}</span>
          </div>
        )}

        {mode === 'corral' && (
          <div className="reader-summary">
            <strong>{selectedPenIds.length}</strong>
            <span>corrales seleccionados</span>
          </div>
        )}
      </div>

      {mode === 'corral' ? (
        <div className="reader-pen-grid">
          {pens.map((pen) => (
            <label key={pen.id} className={selectedPenIds.includes(pen.id) ? 'selected' : ''}>
              <input
                type="checkbox"
                checked={selectedPenIds.includes(pen.id)}
                onChange={() => togglePen(pen.id)}
              />
              <span>{pen.nombre || pen.name || `Corral ${pen.id}`}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="reader-list">
          {selectedAnimals.map((animal) => (
            <article key={animal.id} className="reader-list-item">
              <div>
                <strong>{animal.crotal}</strong>
                <span>{animalSpeciesName(animal)} - {animalPenName(animal)}</span>
              </div>
              <button type="button" className="secondary" onClick={() => removeAnimal(animal.id)}>
                Quitar
              </button>
            </article>
          ))}

          {unknownCodes.map((item) => (
            <article key={item.code} className="reader-list-item warning">
              <div>
                <strong>{item.code}</strong>
                <span>No encontrado en animales registrados.</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="reader-actions">
        <button type="button" onClick={finishSession} disabled={!canFinish}>
          Finalizar
        </button>
        <button type="button" className="secondary" onClick={() => resetSession()}>
          Limpiar lectura
        </button>
      </div>

      {lastDraft && (
        <div className="reader-draft">
          <strong>Borrador preparado</strong>
          <p>
            {lastDraft.mode === 'corral'
              ? `${lastDraft.pens.length} corral(es) para ${ACTIONS.find((item) => item.key === lastDraft.actionKind)?.label}.`
              : `${lastDraft.animals.length} animal(es) y ${lastDraft.unknownCodes.length} lectura(s) no encontrada(s).`}
          </p>
        </div>
      )}
    </section>
  );
}
