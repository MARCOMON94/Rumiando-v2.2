import { useState } from 'react';
import { put } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';

export default function UserSettingsPanel({ onBack }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.nombre || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await put('/account-settings/me', {
        nombre: name
      });
      await refreshUser?.();
      setMessage('Usuario actualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-user-panel">
      <button type="button" className="secondary settings-back-button" onClick={onBack}>
        Volver
      </button>

      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert">{message}</p>}

      <form className="settings-subform" onSubmit={saveUser}>
        <label>
          Nombre
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <div className="settings-readonly-grid">
          <div>
            <span>Email</span>
            <strong>{user?.email || 'Sin email'}</strong>
          </div>
          <div>
            <span>Rol</span>
            <strong>{user?.rol || 'Sin rol'}</strong>
          </div>
          <div>
            <span>Acceso</span>
            <strong>{user?.authProvider || 'Google'}</strong>
          </div>
        </div>

        <p className="settings-sensitive-note">
          El email de acceso se mantiene vinculado a Google y no se edita desde aquí.
        </p>

        <button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar usuario'}
        </button>
      </form>
    </div>
  );
}
