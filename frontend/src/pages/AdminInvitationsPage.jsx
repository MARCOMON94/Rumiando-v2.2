import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import AppModal from '../components/ui/AppModal';

function formatDate(value) {
  if (!value) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getStatusText(status) {
  const labels = {
    PENDING: 'Pendiente',
    ACCEPTED: 'Aceptada',
    EXPIRED: 'Caducada',
    REVOKED: 'Revocada'
  };

  return labels[status] || status || 'Sin estado';
}

function getRoleText(role) {
  const labels = {
    ADMIN: 'Administrador',
    OPERARIO: 'Operario'
  };

  return labels[role] || role || 'Sin rol';
}

export default function AdminInvitationsPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('OPERARIO');
  const [invitations, setInvitations] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [error, setError] = useState('');

  const isAdmin = user?.rol === 'ADMIN';

  const loadInvitations = useCallback(async function loadInvitations() {
    if (!isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const data = await get('/invitations');
      setInvitations(data.invitations || []);
    } catch (err) {
      setError(err.message || 'Error cargando invitaciones');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Introduce un email valido.');
      return;
    }

    setCreating(true);
    setSuccessMessage('');
    setError('');

    try {
      const data = await post('/invitations', {
        email: normalizedEmail,
        rol: role
      });

      setSuccessMessage(data.message || 'Invitacion creada correctamente.');

      setEmail('');
      setRole('OPERARIO');
      await loadInvitations();
    } catch (err) {
      setError(err.message || 'Error creando invitacion');
    } finally {
      setCreating(false);
    }
  }

  function handleCancelInvitation(invitation) {
    setPendingCancel(invitation);
  }

  async function confirmCancelInvitation() {
    if (!pendingCancel) return;

    const invitation = pendingCancel;
    setCancellingId(invitation.id);
    setSuccessMessage('');
    setError('');

    try {
      const data = await post(`/invitations/${invitation.id}/cancel`, {});

      setSuccessMessage(data.message || 'Invitacion cancelada correctamente.');
      await loadInvitations();
      setPendingCancel(null);
    } catch (err) {
      setError(err.message || 'Error cancelando invitacion');
    } finally {
      setCancellingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <section className="page">
        <header className="page-header">
          <div>
            <h2>Invitaciones</h2>
            <p>Solo un usuario administrador puede gestionar invitaciones.</p>
          </div>
        </header>

        <div className="empty-state">
          <h3>Acceso no permitido</h3>
          <p>Tu usuario no tiene permisos de administrador.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Invitaciones</h2>
          <p>
            Crea enlaces de acceso para que nuevos usuarios entren con Google.
            El sistema envia automaticamente un correo visual al email invitado.
          </p>
        </div>

        <button type="button" onClick={loadInvitations} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error && (
        <p className="alert error">
          Error: {error}
        </p>
      )}

      {successMessage && (
        <p className="alert">
          {successMessage}
        </p>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Nueva invitacion</h3>
            <p>
              Introduce el email del usuario y su rol. La invitacion se enviara
              automaticamente por correo y solo podra aceptarse con ese mismo email.
            </p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            <span>Email del usuario</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operario@gmail.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Rol</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="OPERARIO">Operario</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={creating}>
              {creating ? 'Enviando...' : 'Crear invitacion'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Invitaciones creadas</h3>
            <p>Historial de invitaciones de esta cuenta ganadera.</p>
          </div>
        </div>

        {loading && <p>Cargando invitaciones...</p>}

        {!loading && invitations.length === 0 && (
          <div className="empty-state">
            <h3>No hay invitaciones</h3>
            <p>Aun no se ha creado ninguna invitacion.</p>
          </div>
        )}

        {!loading && invitations.length > 0 && (
          <div className="cards-list">
            {invitations.map((invitation) => (
              <article className="panel" key={invitation.id}>
                <div className="animal-card-header">
                  <span className="tag">
                    {getStatusText(invitation.status)}
                  </span>
                  <span className="tag">
                    {getRoleText(invitation.rol)}
                  </span>
                </div>

                <h3>{invitation.email}</h3>

                <p>
                  <strong>Creada:</strong>{' '}
                  {formatDate(invitation.createdAt)}
                </p>

                <p>
                  <strong>Caduca:</strong>{' '}
                  {formatDate(invitation.expiresAt)}
                </p>

                {invitation.invitedBy && (
                  <p>
                    <strong>Invitada por:</strong>{' '}
                    {invitation.invitedBy.nombre || invitation.invitedBy.email}
                  </p>
                )}

                {invitation.acceptedAt && (
                  <p>
                    <strong>Aceptada:</strong>{' '}
                    {formatDate(invitation.acceptedAt)}
                  </p>
                )}

                {invitation.acceptedByUser && (
                  <p>
                    <strong>Usuario creado:</strong>{' '}
                    {invitation.acceptedByUser.nombre || invitation.acceptedByUser.email}
                  </p>
                )}

                {invitation.status === 'PENDING' && (
                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleCancelInvitation(invitation)}
                      disabled={cancellingId === invitation.id}
                    >
                      {cancellingId === invitation.id
                        ? 'Cancelando...'
                        : 'Cancelar invitacion'}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <AppModal
        open={Boolean(pendingCancel)}
        title="Cancelar invitacion"
        description={`Se cancelara la invitacion enviada a ${pendingCancel?.email || ''}.`}
        onClose={() => {
          if (!cancellingId) setPendingCancel(null);
        }}
      >
        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => setPendingCancel(null)}
            disabled={Boolean(cancellingId)}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={confirmCancelInvitation}
            disabled={Boolean(cancellingId)}
          >
            {cancellingId ? 'Cancelando...' : 'Cancelar invitacion'}
          </button>
        </div>
      </AppModal>
    </section>
  );
}
