import { useState } from 'react';
import { post } from '../../api/apiClient';

export default function AnimalWatchlistButton({
  animalId,
  motivoTipo,
  motivoTexto = '',
  sourceType = 'manual',
  sourceRef,
  promptReason = false,
  label = 'Animal Watchlist',
  className = 'secondary',
  onAdded
}) {
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    if (!animalId || saving) return;

    let nextReason = motivoTexto;

    if (promptReason) {
      const promptedReason = window.prompt(
        'Motivo opcional para Animal Watchlist. Puedes dejarlo vacio.',
        motivoTexto || ''
      );

      if (promptedReason === null) {
        return;
      }

      nextReason = promptedReason;
    }

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
    }
  }

  return (
    <span className="watchlist-add-wrapper">
      <button
        type="button"
        className={className}
        onClick={handleClick}
        disabled={!animalId || saving}
        title={error || (added ? 'Anadido a Animal Watchlist' : 'Anadir a Animal Watchlist')}
        aria-label="Anadir a Animal Watchlist"
      >
        <span className="css-search-icon watchlist-button-icon" aria-hidden="true" />
        <span>{saving ? 'Anadiendo...' : added ? 'Anadido' : label}</span>
      </button>
      {error && <span className="watchlist-add-error">{error}</span>}
    </span>
  );
}
