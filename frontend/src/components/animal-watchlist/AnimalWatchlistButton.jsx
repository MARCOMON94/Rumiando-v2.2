import { useCallback, useEffect, useState } from 'react';
import { del, get, post } from '../../api/apiClient';
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
  disabled = false,
  onAdded
}) {
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [watchlistItemId, setWatchlistItemId] = useState(null);
  const [error, setError] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [draftReason, setDraftReason] = useState(motivoTexto || '');

  const checkExistingItem = useCallback(async function checkExistingItem() {
    if (!animalId) {
      setAdded(false);
      setWatchlistItemId(null);
      return null;
    }

    try {
      const data = await get('/animal-watchlist');
      const items = Array.isArray(data?.data) ? data.data : [];
      const existingItem = items.find((item) => (
        Number(item.animalId || item.animal?.id) === Number(animalId)
      ));

      setAdded(Boolean(existingItem));
      setWatchlistItemId(existingItem?.id || null);

      return existingItem || null;
    } catch {
      setAdded(false);
      setWatchlistItemId(null);
      return null;
    }
  }, [animalId]);

  useEffect(() => {
    checkExistingItem();
    window.addEventListener('animal-watchlist:changed', checkExistingItem);

    return () => {
      window.removeEventListener('animal-watchlist:changed', checkExistingItem);
    };
  }, [checkExistingItem]);

  async function saveToWatchlist(nextReason) {
    if (!animalId || disabled || saving || added) return;

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
      setWatchlistItemId(item?.id || null);
      window.dispatchEvent(new Event('animal-watchlist:changed'));
      onAdded?.(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setReasonOpen(false);
    }
  }

  async function removeFromWatchlist() {
    if (!animalId || disabled || saving) return;

    setSaving(true);
    setError('');

    try {
      const existingItem = watchlistItemId ? { id: watchlistItemId } : await checkExistingItem();

      if (existingItem?.id) {
        await del(`/animal-watchlist/${existingItem.id}`);
      }

      setAdded(false);
      setWatchlistItemId(null);
      window.dispatchEvent(new Event('animal-watchlist:changed'));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleClick() {
    if (!animalId || disabled || saving) return;

    if (added) {
      removeFromWatchlist();
      return;
    }

    if (promptReason) {
      setDraftReason(motivoTexto || '');
      setReasonOpen(true);
      return;
    }

    saveToWatchlist(motivoTexto);
  }

  const statusLabel = added ? 'Añadido' : label;
  const title = error || (added ? 'Quitar de Búsqueda inteligente' : 'Añadir a Búsqueda inteligente');
  const savingLabel = added ? 'Quitando...' : 'Añadiendo...';

  return (
    <>
      <span className="watchlist-add-wrapper">
        <button
          type="button"
          className={`${className} ${added ? 'watchlist-added' : ''}`}
          onClick={handleClick}
          disabled={!animalId || disabled || saving}
          title={title}
          aria-label={title}
        >
          <span className="watchlist-button-mark" aria-hidden="true">
            <img
              src="/assets/rumiando-sheep-facing-left.png"
              alt=""
            />
            {(iconOnly && showMiniLabel) && <small>{statusLabel}</small>}
          </span>
          {!iconOnly && <span>{saving ? savingLabel : statusLabel}</span>}
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
