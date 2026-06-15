import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, put } from '../api/apiClient';
import AppModal from '../components/ui/AppModal';
import useReaderCapture from '../hooks/useReaderCapture';

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.animals)) return data.animals;
  if (Array.isArray(data?.animales)) return data.animales;
  return [];
}

function normalizeCode(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function extractCodes(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeCode)
    .filter(Boolean);
}

function lastFour(value) {
  const clean = normalizeCode(value);
  return clean.slice(-4) || clean || '----';
}

function formatAge(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days < 30) return `${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} meses`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return remainingMonths ? `${years} años y ${remainingMonths} meses` : `${years} años`;
}

export default function OffspringPage() {
  const navigate = useNavigate();
  const readerInputRef = useRef(null);
  const readerBufferRef = useRef('');
  const readerTimerRef = useRef(null);

  const [offspring, setOffspring] = useState([]);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [pendingCode, setPendingCode] = useState('');
  const [readerMessage, setReaderMessage] = useState('Elige una cría y pasa el lector para añadir su crotal definitivo.');
  const [flashKey, setFlashKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const readerActive = Boolean(selectedAnimal);

  const focusReader = useCallback(function focusReader() {
    if (!readerActive) return;
    window.setTimeout(() => {
      readerInputRef.current?.focus?.({ preventScroll: true });
    }, 0);
  }, [readerActive]);

  const loadOffspring = useCallback(async function loadOffspring() {
    setLoading(true);
    setError('');
    try {
      const data = await get('/animals?estadoRegistro=ACTIVO&crotalDefinitivo=false');
      setOffspring(getItems(data));
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista de crías.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffspring();
  }, [loadOffspring]);

  useEffect(() => {
    if (!pendingCode) focusReader();
  }, [focusReader, pendingCode, selectedAnimal]);

  function activateReader(animal) {
    setSelectedAnimal(animal);
    setPendingCode('');
    setSuccess('');
    setError('');
    setReaderMessage(`Pasa el crotal definitivo de ${animal.crotal}.`);
    focusReader();
  }

  const handleCodes = useCallback(function handleCodes(rawCodes) {
    const codes = Array.isArray(rawCodes) ? rawCodes.map(normalizeCode).filter(Boolean) : extractCodes(rawCodes);
    const code = codes[0];
    if (!code || !selectedAnimal) return;

    if (code === normalizeCode(selectedAnimal.crotal)) {
      setReaderMessage('Ese crotal coincide con el provisional actual.');
      return;
    }

    setPendingCode(code);
    setReaderMessage(`Crotal leído: ${code}. Confirma para asignarlo.`);
    setFlashKey((current) => current + 1);
  }, [selectedAnimal]);

  useReaderCapture({
    active: readerActive && !pendingCode,
    delay: 160,
    extractCodes,
    onCodes: handleCodes,
    shouldCaptureIgnoredPaste: (pasted) => extractCodes(pasted).length > 0
  });

  function flushReaderBuffer() {
    const raw = readerBufferRef.current;
    readerBufferRef.current = '';
    window.clearTimeout(readerTimerRef.current);
    handleCodes(extractCodes(raw));
  }

  function handleReaderKeyDown(event) {
    const finishKey = event.key === 'Enter' || event.key === 'Tab';
    const characterKey = event.key.length === 1;
    if (!finishKey && !characterKey && event.key !== 'Backspace') return;

    event.preventDefault();
    if (finishKey) {
      flushReaderBuffer();
      return;
    }
    if (event.key === 'Backspace') {
      readerBufferRef.current = readerBufferRef.current.slice(0, -1);
      return;
    }
    readerBufferRef.current += event.key;
    window.clearTimeout(readerTimerRef.current);
    readerTimerRef.current = window.setTimeout(flushReaderBuffer, 180);
  }

  async function confirmEarTag() {
    if (!selectedAnimal?.id || !pendingCode || saving) return;

    setSaving(true);
    setError('');
    try {
      await put(`/animals/${selectedAnimal.id}`, {
        crotal: pendingCode,
        crotalDefinitivo: true
      });
      setSuccess(`${selectedAnimal.crotal} actualizado como ${pendingCode}.`);
      setPendingCode('');
      setSelectedAnimal(null);
      await loadOffspring();
    } catch (err) {
      setError(err.message || 'No se pudo asignar el crotal definitivo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page offspring-page">
      {flashKey > 0 && <span key={flashKey} className="watchlist-screen-flash reader-green-flash" aria-hidden="true" />}

      <div className="panel offspring-header-card">
        <div>
          <p className="eyebrow">Cría</p>
          <h2>Crías sin crotal definitivo</h2>
          <p>Asigna el crotal oficial cuando lo tengas. Al actualizar, desaparecen de esta lista.</p>
        </div>
        <button type="button" className="secondary" onClick={loadOffspring} disabled={loading}>
          Actualizar lista
        </button>
      </div>

      {error && <p className="alert error">{error}</p>}
      {success && <p className="alert success">{success}</p>}

      {readerActive && (
        <div className="panel offspring-reader-card">
          <input
            ref={readerInputRef}
            className="batch-reader-input"
            data-reader-capture="true"
            aria-label="Lector de crotal definitivo"
            onKeyDown={handleReaderKeyDown}
            onPaste={(event) => {
              event.preventDefault();
              handleCodes(extractCodes(event.clipboardData?.getData('text')));
            }}
          />
          <div className="batch-reader-status">
            <span className="batch-reader-dot" aria-hidden="true" />
            <strong>Lector activo</strong>
            <p>{readerMessage}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p>Cargando crías...</p>
      ) : offspring.length === 0 ? (
        <div className="empty-state">
          <h3>Lista al día</h3>
          <p>No hay crías activas pendientes de crotal definitivo.</p>
        </div>
      ) : (
        <div className="offspring-list">
          {offspring.map((animal) => (
            <article className="offspring-card" key={animal.id}>
              <div className="offspring-tag">
                <span>Provisional</span>
                <strong>{lastFour(animal.crotal)}</strong>
              </div>

              <div className="offspring-main">
                <strong>{animal.crotal}</strong>
                <span>{animal.sexo || 'Sin sexo'} · {formatAge(animal.fechaNacimiento)}</span>
                <span>{animal.corralActual?.nombre || 'Sin corral'} · Madre {animal.madre?.crotal || 'no registrada'}</span>
              </div>

              <div className="offspring-actions">
                <button type="button" className="secondary" onClick={() => activateReader(animal)}>
                  Añadir crotal
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigate(`/animals/${animal.id}/discharge`, { state: { returnTo: '/offspring', returnMode: 'back' } })}
                >
                  Baja
                </button>
                <Link className="button secondary" to={`/animals/${animal.id}`}>
                  Ficha
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <AppModal
        open={Boolean(pendingCode && selectedAnimal)}
        title="Asignar crotal definitivo"
        description={selectedAnimal ? `${selectedAnimal.crotal} pasará a ser ${pendingCode}.` : ''}
        onClose={() => {
          if (!saving) setPendingCode('');
        }}
      >
        <div className="app-modal-footer">
          <button type="button" className="secondary" onClick={() => setPendingCode('')} disabled={saving}>
            Cancelar
          </button>
          <button type="button" onClick={confirmEarTag} disabled={saving}>
            Confirmar crotal
          </button>
        </div>
      </AppModal>
    </section>
  );
}
