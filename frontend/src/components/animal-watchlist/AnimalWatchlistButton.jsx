import { useState } from 'react';
import { post } from '../../api/apiClient';
import AppModal from '../ui/AppModal';

export default function AnimalWatchlistButton({
  animalId,
  motivoTipo,
  motivoTexto = '',
  sourceType = 'manual',
  sourceRef,
  promptReason = false,
  label = 'Búsqueda',
  className = 'secondary',
  iconOnly = false,
  showMiniLabel = false,
  onAdded
}) {
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [draftReason, setDraftReason] = useState(motivoTexto || '');

  async function saveToWatchlist(nextReason) {
    if (!animalId || saving) return;

    setSaving(true);
    setError('');

    try {
      const item = await post('/animal-watchlist', {
        animalId,
        motivoTipo: motivoTipo || null,
        motivoTexto: nextReason || null,
        sourceType,
        sourceRef: sourceRef || null
      });

      setAdded(true);
      window.dispatchEvent(new Event('animal-watchlist:changed'));
      onAdded?.(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setReasonOpen(false);
    }
  }

  function handleClick() {
    if (!animalId || saving) return;

    if (promptReason) {
      setDraftReason(motivoTexto || '');
      setReasonOpen(true);
      return;
    }

    saveToWatchlist(motivoTexto);
  }

  return (
    <>
      <span className="watchlist-add-wrapper">
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={!animalId || saving}
        title={error || (added ? 'Añadido a Búsqueda inteligente' : 'Añadir a Búsqueda inteligente')}
        aria-label="Añadir a Búsqueda inteligente"
      >
        <span className="watchlist-button-mark" aria-hidden="true">
          <img
            src="/assets/rumiando-sheep-facing-left.png"
            alt=""
          />
          {(iconOnly && showMiniLabel) && <small>Búsqueda</small>}
        </span>
        {!iconOnly && <span>{saving ? 'Añadiendo...' : added ? 'Añadido' : label}</span>}
      </button>
      {error && <span className="watchlist-add-error">{error}</span>}
      </span>

      <AppModal
        open={reasonOpen}
        title="Añadir a Búsqueda inteligente"
        description="Motivo opcional para localizar este animal más tarde."
        onClose={() => {
          if (!saving) setReasonOpen(false);
        }}
      >
        <label>
          Motivo
          <textarea
            value={draftReason}
            onChange={(event) => setDraftReason(event.target.value)}
            rows="3"
            placeholder="Puedes dejarlo vacío"
          />
        </label>

        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => setReasonOpen(false)}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => saveToWatchlist(draftReason)}
            disabled={saving}
          >
            {saving ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </AppModal>
    </>
  );
}
