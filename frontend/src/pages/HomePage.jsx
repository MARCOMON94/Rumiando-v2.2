import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../api/apiClient';
import OperationSessionPanel from '../components/operations/OperationSessionPanel';
import { OPERATION_DEFINITIONS } from '../components/operations/operationConfig';
import AnimalReaderPanel from '../components/reader/AnimalReaderPanel';
import { useOperationSession } from '../context/OperationSessionContext';

function modeForOperation(operationType) {
  if (operationType === 'baja' || operationType === 'estado_reproductivo') {
    return 'unitario';
  }
  return 'lote';
}

export default function HomePage() {
  const navigate = useNavigate();
  const { startOperation } = useOperationSession();
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerNotice, setReaderNotice] = useState('');
  const [watchlistTotal, setWatchlistTotal] = useState(0);

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

  function openOperation(operationType) {
    setReaderOpen(false);
    startOperation({
      operationType,
      mode: modeForOperation(operationType),
      source: 'home',
      status: 'reading'
    });
  }

  function handleAnimalRead(animal) {
    if (!animal?.id) return;
    setReaderNotice(`${animal.crotal} encontrado.`);
    navigate(`/animals/${animal.id}?preview=1`);
  }

  return (
    <section className="clean-home-page field-home-page">
      <div className="field-home-header">
        <div>
          <p className="eyebrow">RumiAndo</p>
          <h2>Trabajo de campo</h2>
          <p>Lee un crotal, abre el chat o registra una operacion.</p>
        </div>

        <div className="field-home-top-actions">
          <button type="button" className="field-reader-button" onClick={() => setReaderOpen((value) => !value)}>
            Lector
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/ai-chat')}>
            Chat IA
          </button>
          <button
            type="button"
            className="secondary field-watchlist-button"
            onClick={() => navigate('/animal-watchlist')}
          >
            <span>Animal Watchlist</span>
            <span className="watchlist-nav-count">{watchlistTotal}</span>
          </button>
        </div>
      </div>

      {readerOpen && (
        <AnimalReaderPanel
          compact
          title="Lector de crotal"
          subtitle="Pasa el lector. Si el crotal existe, se abre la ficha previa."
          initialMode="unitario"
          hideActionSelect
          onAnimalRead={handleAnimalRead}
          onUnknownRead={(code) => setReaderNotice(`${code} no esta registrado.`)}
        />
      )}

      {readerNotice && <p className="alert">{readerNotice}</p>}

      <div className="field-operation-grid" aria-label="Operaciones principales">
        {OPERATION_DEFINITIONS.map((operation) => (
          <button
            key={operation.key}
            type="button"
            className="field-operation-button"
            onClick={() => openOperation(operation.key)}
          >
            <span>{operation.label}</span>
          </button>
        ))}
      </div>

      <OperationSessionPanel />
    </section>
  );
}
