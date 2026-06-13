import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put } from '../../api/apiClient';

function emptyAccountForm() {
  return {
    nombre: '',
    titularNombre: '',
    telefono: '',
    emailContacto: ''
  };
}

export default function FarmAccountSettingsPanel({ currentUser }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);
  const [unitDrafts, setUnitDrafts] = useState({});
  const [userDrafts, setUserDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const breedsBySpecies = useMemo(() => {
    const grouped = new Map();

    for (const breed of settings?.razas || []) {
      const key = String(breed.especieId || breed.especie?.id || '');
      const items = grouped.get(key) || [];
      items.push(breed);
      grouped.set(key, items);
    }

    return grouped;
  }, [settings?.razas]);

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const data = await get('/account-settings');
      setSettings(data);
      setAccountForm({
        nombre: data.nombre || '',
        titularNombre: data.titularNombre || '',
        telefono: data.telefono || '',
        emailContacto: data.emailContacto || ''
      });
      setUnitDrafts(Object.fromEntries((data.unidadesRega || []).map((unit) => [
        unit.id,
        {
          nombre: unit.nombre || '',
          codigoRega: unit.codigoRega || '',
          especiePrincipalId: unit.especiePrincipalId ? String(unit.especiePrincipalId) : '',
          razaPrincipalId: unit.razaPrincipalId ? String(unit.razaPrincipalId) : ''
        }
      ])));
      setUserDrafts(Object.fromEntries((data.usuarios || []).map((user) => [
        user.id,
        {
          nombre: user.nombre || '',
          rol: user.rol || 'OPERARIO',
          activo: user.activo !== false
        }
      ])));
    } catch (err) {
      setError(err.message || 'Error cargando cuenta ganadera');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function setAccountField(name, value) {
    setAccountForm((current) => ({
      ...current,
      [name]: value
    }));
    setMessage('');
  }

  function setUnitField(unitId, name, value) {
    setUnitDrafts((current) => {
      const nextDraft = {
        ...current[unitId],
        [name]: value
      };

      if (name === 'especiePrincipalId') {
        nextDraft.razaPrincipalId = '';
      }

      return {
        ...current,
        [unitId]: nextDraft
      };
    });
    setMessage('');
  }

  function setUserField(userId, name, value) {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [name]: value
      }
    }));
    setMessage('');
  }

  async function saveAccount(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await put('/account-settings/account', accountForm);
      setMessage('Cuenta ganadera actualizada.');
      await loadSettings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveUnit(unitId) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await put(`/account-settings/farm-units/${unitId}`, unitDrafts[unitId]);
      setMessage('REGA actualizada.');
      await loadSettings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveUser(userId) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      await put(`/account-settings/users/${userId}`, userDrafts[userId]);
      setMessage('Usuario actualizado.');
      await loadSettings();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Cargando cuenta ganadera...</p>;
  }

  return (
    <div className="settings-account-panel">
      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert">{message}</p>}

      <form className="settings-subform" onSubmit={saveAccount}>
        <h3>Explotación</h3>
        <label>
          Nombre de explotación
          <input
            value={accountForm.nombre}
            onChange={(event) => setAccountField('nombre', event.target.value)}
            required
          />
        </label>
        <label>
          Titular visible
          <input
            value={accountForm.titularNombre}
            onChange={(event) => setAccountField('titularNombre', event.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label>
          Teléfono
          <input
            value={accountForm.telefono}
            onChange={(event) => setAccountField('telefono', event.target.value)}
            placeholder="Opcional"
          />
        </label>
        <label>
          Email de contacto
          <input
            type="email"
            value={accountForm.emailContacto}
            onChange={(event) => setAccountField('emailContacto', event.target.value)}
            placeholder="Opcional"
          />
        </label>
        <p className="settings-sensitive-note">
          NIF y dirección quedan fuera por ahora para no guardar datos sensibles sin cifrado gestionado.
        </p>
        <button type="submit" disabled={saving}>
          Guardar explotación
        </button>
      </form>

      <section className="settings-subform">
        <h3>REGAs</h3>
        {(settings?.unidadesRega || []).map((unit) => {
          const draft = unitDrafts[unit.id] || {};
          const availableBreeds = breedsBySpecies.get(String(draft.especiePrincipalId || '')) || [];

          return (
            <article className="settings-list-row settings-unit-row" key={unit.id}>
              <div className="settings-unit-fields">
                <label>
                  Nombre
                  <input
                    value={draft.nombre || ''}
                    onChange={(event) => setUnitField(unit.id, 'nombre', event.target.value)}
                  />
                </label>
                <label>
                  Número REGA
                  <input
                    value={draft.codigoRega || ''}
                    onChange={(event) => setUnitField(unit.id, 'codigoRega', event.target.value)}
                  />
                </label>
                <label>
                  Especie
                  <select
                    value={draft.especiePrincipalId || ''}
                    onChange={(event) => setUnitField(unit.id, 'especiePrincipalId', event.target.value)}
                  >
                    <option value="">Sin especie</option>
                    {(settings?.especies || []).map((species) => (
                      <option key={species.id} value={species.id}>
                        {species.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Raza
                  <select
                    value={draft.razaPrincipalId || ''}
                    onChange={(event) => setUnitField(unit.id, 'razaPrincipalId', event.target.value)}
                    disabled={!draft.especiePrincipalId}
                  >
                    <option value="">Sin raza</option>
                    {availableBreeds.map((breed) => (
                      <option key={breed.id} value={breed.id}>
                        {breed.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" onClick={() => saveUnit(unit.id)} disabled={saving}>
                Guardar REGA
              </button>
            </article>
          );
        })}
      </section>

      <section className="settings-subform">
        <div className="settings-section-title-row">
          <h3>Usuarios asociados</h3>
          <button
            type="button"
            className="secondary"
            onClick={() => navigate('/admin/invitations')}
          >
            Invitar
          </button>
        </div>

        {(settings?.usuarios || []).map((accountUser) => {
          const draft = userDrafts[accountUser.id] || {};
          const isCurrentUser = Number(accountUser.id) === Number(currentUser?.id);

          return (
            <article className="settings-list-row settings-user-row" key={accountUser.id}>
              <div>
                <strong>{accountUser.email}</strong>
                <span>{accountUser.authProvider}</span>
              </div>
              <label>
                Nombre
                <input
                  value={draft.nombre || ''}
                  onChange={(event) => setUserField(accountUser.id, 'nombre', event.target.value)}
                />
              </label>
              <label>
                Rol
                <select
                  value={draft.rol || 'OPERARIO'}
                  onChange={(event) => setUserField(accountUser.id, 'rol', event.target.value)}
                  disabled={isCurrentUser}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="OPERARIO">Operario</option>
                </select>
              </label>
              <label className="batch-checkbox">
                <input
                  type="checkbox"
                  checked={draft.activo !== false}
                  onChange={(event) => setUserField(accountUser.id, 'activo', event.target.checked)}
                  disabled={isCurrentUser}
                />
                Activo
              </label>
              <button type="button" onClick={() => saveUser(accountUser.id)} disabled={saving}>
                Guardar
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
