import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get } from '../api/apiClient';

function activateSilentReader() {
  window.dispatchEvent(new CustomEvent('rumiando:silent-reader:activate'));
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  useEffect(() => {
    if (searchParams.get('reader') === '1') {
      activateSilentReader();
    }
  }, [searchParams]);

  return (
    <section className="clean-home-page field-home-page">
      <div className="field-home-header">
        <div>
          <p className="eyebrow">RumiAndo</p>
          <h2>Trabajo de campo</h2>
          <p>Elige una acción o usa el lector para abrir la ficha del animal.</p>
        </div>
      </div>

      <div className="field-operation-grid field-operation-grid-custom" aria-label="Operaciones principales">
        <button
          type="button"
          className="field-operation-button field-operation-wide field-operation-live"
          onClick={activateSilentReader}
        >
          <span>Búsqueda viva</span>

          <span className="field-watchlist-pill">
            <strong>{watchlistTotal}</strong>
            <span aria-hidden="true">🐑</span>
          </span>
        </button>

        <button
          type="button"
          className="field-operation-button"
          onClick={activateSilentReader}
        >
          <span>Parto</span>
        </button>

        <button
          type="button"
          className="field-operation-button"
          onClick={activateSilentReader}
        >
          <span>Baja</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/movements')}
        >
          <span>Movimiento de corral</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/animals')}
        >
          <span>Estado reproductivo</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/health')}
        >
          <span>Caso sanitario</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/animals')}
        >
          <span>Censo</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/dashboard')}
        >
          <span>Estadísticas</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/reminders')}
        >
          <span>Alertas</span>
        </button>

        <button
          type="button"
          className="field-operation-button field-operation-wide"
          onClick={() => navigate('/ai-chat')}
        >
          <span>Asistente IA</span>
        </button>
      </div>
    </section>
  );
}