import { useEffect, useState } from 'react';
import { get, post } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

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

function buildInvitationSubject({ farmName }) {
  return `Invitación para acceder a ${farmName || 'RumiAndo'}`;
}

function buildInvitationBody({ invitationUrl, email, role, farmName, invitedByName }) {
  const displayFarmName = farmName || 'RumiAndo';
  const displayInvitedBy = invitedByName || 'Un administrador';

  return [
    'RUMIANDO',
    'Gestión ganadera',
    '',
    'Invitación de acceso',
    '',
    `Hola,`,
    '',
    `${displayInvitedBy} te ha invitado a acceder a ${displayFarmName} en RumiAndo.`,
    '',
    'Datos de la invitación:',
    `- Email invitado: ${email}`,
    `- Rol asignado: ${role}`,
    '',
    'Para aceptar la invitación:',
    '1. Abre el enlace siguiente.',
    '2. Entra con Google.',
    '3. Usa exactamente el mismo email indicado arriba.',
    '',
    invitationUrl,
    '',
    'Esta invitación es personal y caduca automáticamente.',
    '',
    'Si no esperabas este correo, puedes ignorarlo.',
    '',
    'Un saludo,',
    'Equipo RumiAndo'
  ].join('\n');
}

function buildMailtoUrl(invitation) {
  const subject = encodeURIComponent(buildInvitationSubject(invitation));
  const body = encodeURIComponent(buildInvitationBody(invitation));

  return `mailto:${encodeURIComponent(invitation.email)}?subject=${subject}&body=${body}`;
}

function buildGmailComposeUrl(invitation) {
  const subject = encodeURIComponent(buildInvitationSubject(invitation));
  const body = encodeURIComponent(buildInvitationBody(invitation));

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitation.email)}&su=${subject}&body=${body}`;
}

export default function AdminInvitationsPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('OPERARIO');
  const [invitations, setInvitations] = useState([]);
  const [lastInvitation, setLastInvitation] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user?.rol === 'ADMIN';

  async function loadInvitations() {
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
  }

  useEffect(() => {
    loadInvitations();
  }, [isAdmin]);

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Introduce un email válido.');
      return;
    }

    setCreating(true);
    setCopied(false);
    setError('');

    try {
      const data = await post('/invitations', {
        email: normalizedEmail,
        rol: role
      });

      setLastInvitation({
        url: data.invitationUrl || '',
        email: normalizedEmail,
        role,
        farmName: data.invitation?.cuentaGanadera?.nombre || 'RumiAndo',
        invitedByName: user?.nombre || user?.email || 'Un administrador'
      });

      setEmail('');
      setRole('OPERARIO');
      await loadInvitations();
    } catch (err) {
      setError(err.message || 'Error creando invitación');
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyInvitationUrl() {
    if (!lastInvitation?.url) return;

    try {
      await navigator.clipboard.writeText(lastInvitation.url);
      setCopied(true);
    } catch {
      setCopied(false);
      setError('No se pudo copiar el enlace. Cópialo manualmente.');
    }
  }

  function handleOpenGmail() {
    if (!lastInvitation?.url) return;

    window.open(
      buildGmailComposeUrl({
        invitationUrl: lastInvitation.url,
        email: lastInvitation.email,
        role: lastInvitation.role,
        farmName: lastInvitation.farmName,
        invitedByName: lastInvitation.invitedByName
      }),
      '_blank',
      'noopener,noreferrer'
    );
  }

  function handleOpenMailApp() {
    if (!lastInvitation?.url) return;

    window.location.href = buildMailtoUrl({
      invitationUrl: lastInvitation.url,
      email: lastInvitation.email,
      role: lastInvitation.role,
      farmName: lastInvitation.farmName,
      invitedByName: lastInvitation.invitedByName
    });
  }

  if (!isAdmin) {
    return (
      <section className="page">
        <header className="page-header">
          <div>
            <p className="eyebrow">Administración</p>
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
          <p className="eyebrow">Administración</p>
          <h2>Invitaciones</h2>
          <p>
            Crea enlaces de acceso para que nuevos usuarios entren con Google.
            El enlace caduca y solo funciona con el email invitado.
          </p>
        </div>

        <button type="button" onClick={loadInvitations} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {error && <p className="alert error">Error: {error}</p>}

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Nueva invitación</h3>
            <p>
              Genera una invitación segura y abre Gmail con el mensaje ya preparado.
              El administrador solo tendrá que revisar y enviar.
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
              {creating ? 'Creando...' : 'Crear invitación'}
            </button>
          </div>
        </form>

        {lastInvitation?.url && (
          <div className="panel">
            <div className="section-header">
              <div>
                <h3>Invitación generada</h3>
                <p>
                  El enlace ya está creado. Puedes abrir Gmail con el correo preparado
                  o copiar el enlace manualmente.
                </p>
              </div>
            </div>

            <p>
              <strong>Email:</strong> {lastInvitation.email}
            </p>

            <p>
              <strong>Rol:</strong> {lastInvitation.role}
            </p>

            <div className="form-actions">
              <button type="button" onClick={handleOpenGmail}>
                Abrir Gmail
              </button>

              <button type="button" onClick={handleOpenMailApp}>
                Abrir correo
              </button>

              <button type="button" onClick={handleCopyInvitationUrl}>
                {copied ? 'Enlace copiado' : 'Copiar enlace'}
              </button>
            </div>

            <details>
              <summary>Ver enlace de invitación</summary>
              <p className="alert">
                {lastInvitation.url}
              </p>
            </details>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Invitaciones creadas</h3>
            <p>
              Historial de invitaciones de esta cuenta ganadera.
            </p>
          </div>
        </div>

        {loading && <p>Cargando invitaciones...</p>}

        {!loading && invitations.length === 0 && (
          <div className="empty-state">
            <h3>No hay invitaciones</h3>
            <p>Aún no se ha creado ninguna invitación.</p>
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
                    {invitation.rol}
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
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}