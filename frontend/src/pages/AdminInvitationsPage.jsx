import { useCallback, useEffect, useState } from 'react';
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

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildInvitationSubject({ farmName }) {
  return `Invitación para acceder a ${farmName || 'RumiAndo'}`;
}

function buildInvitationBody({ url, email, role, farmName, invitedByName }) {
  const displayFarmName = farmName || 'RumiAndo';
  const displayInvitedBy = invitedByName || 'Un administrador';

  return [
    'RumiAndo - Gestión ganadera',
    '',
    'Invitación de acceso',
    '',
    'Hola,',
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
    url,
    '',
    'Esta invitación es personal y caduca automáticamente.',
    '',
    'Si no esperabas este correo, puedes ignorarlo.',
    '',
    'Un saludo,',
    'Equipo RumiAndo'
  ].join('\n');
}

function buildInvitationHtml({ url, email, role, farmName, invitedByName }) {
  const safeFarmName = escapeHtml(farmName || 'RumiAndo');
  const safeInvitedBy = escapeHtml(invitedByName || 'Un administrador');
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(role || 'OPERARIO');
  const safeUrl = escapeHtml(url);

  return `
    <div style="margin:0;padding:0;background:#f4f4ee;font-family:Arial,Helvetica,sans-serif;color:#1f2f25;">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #d8ded7;border-radius:24px;overflow:hidden;box-shadow:0 16px 38px rgba(35,49,39,0.10);">
          <div style="background:#3f6b4b;padding:26px 24px;text-align:center;color:#ffffff;">
            <div style="font-size:28px;font-weight:900;letter-spacing:0.18em;line-height:1;text-transform:uppercase;">
              RUMIANDO
            </div>
            <div style="margin-top:8px;font-size:15px;font-weight:700;letter-spacing:0.02em;">
              Gestión ganadera
            </div>
          </div>

          <div style="padding:30px 28px 26px;">
            <p style="margin:0 0 8px;color:#3f6b4b;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">
              Invitación de acceso
            </p>

            <h1 style="margin:0 0 18px;color:#1f2f25;font-size:28px;line-height:1.15;font-weight:900;">
              Acceso a ${safeFarmName}
            </h1>

            <p style="margin:0 0 18px;color:#33443a;font-size:16px;line-height:1.55;">
              ${safeInvitedBy} te ha invitado a acceder a <strong>${safeFarmName}</strong> en RumiAndo.
            </p>

            <div style="margin:22px 0;padding:18px 20px;background:#f4f7f1;border:1px solid #dfe8dc;border-radius:18px;">
              <p style="margin:0 0 8px;color:#33443a;font-size:15px;line-height:1.45;">
                <strong>Email invitado:</strong> ${safeEmail}
              </p>
              <p style="margin:0;color:#33443a;font-size:15px;line-height:1.45;">
                <strong>Rol asignado:</strong> ${safeRole}
              </p>
            </div>

            <p style="margin:0 0 24px;color:#33443a;font-size:16px;line-height:1.55;">
              Para aceptar la invitación, pulsa el botón y entra con la misma cuenta de Google indicada arriba.
            </p>

            <div style="text-align:center;margin:30px 0 28px;">
              <a href="${safeUrl}" style="display:inline-block;background:#3f6b4b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 28px;border-radius:999px;box-shadow:0 12px 24px rgba(63,107,75,0.22);">
                Acceder a RumiAndo
              </a>
            </div>

            <p style="margin:0;color:#6f7887;font-size:13px;line-height:1.5;text-align:center;">
              Esta invitación es personal y caduca automáticamente. Si no esperabas este correo, puedes ignorarlo.
            </p>
          </div>

          <div style="padding:18px 24px;background:#f7f7f1;border-top:1px solid #e2e7df;text-align:center;">
            <p style="margin:0;color:#6f7887;font-size:12px;line-height:1.45;">
              RumiAndo · Gestión ganadera digital
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildMailtoUrl(invitation) {
  const subject = encodeURIComponent(buildInvitationSubject(invitation));
  const body = encodeURIComponent(buildInvitationBody(invitation));

  return `mailto:${encodeURIComponent(invitation.email)}?subject=${subject}&body=${body}`;
}

function buildGmailComposeUrl(invitation) {
  const subject = encodeURIComponent(buildInvitationSubject(invitation));

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(invitation.email)}&su=${subject}`;
}

async function copyInvitationEmailToClipboard(invitation) {
  const html = buildInvitationHtml(invitation);
  const text = buildInvitationBody(invitation);

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ]);

    return 'html';
  }

  await navigator.clipboard.writeText(text);
  return 'text';
}

export default function AdminInvitationsPage() {
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('OPERARIO');
  const [invitations, setInvitations] = useState([]);
  const [lastInvitation, setLastInvitation] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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
      setError('Introduce un email válido.');
      return;
    }

    setCreating(true);
    setCopied(false);
    setEmailCopied(false);
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

  async function handlePrepareGmail() {
    if (!lastInvitation?.url) return;

    setError('');

    try {
      const clipboardMode = await copyInvitationEmailToClipboard(lastInvitation);
      setEmailCopied(true);

      window.open(
        buildGmailComposeUrl(lastInvitation),
        '_blank',
        'noopener,noreferrer'
      );

      if (clipboardMode === 'text') {
        setError('Tu navegador solo permitió copiar texto plano. Pégalo en Gmail y envíalo.');
      }
    } catch {
      setEmailCopied(false);
      setError('No se pudo copiar el correo visual. Usa la opción de correo simple o copia el enlace.');
    }
  }

  function handleOpenMailApp() {
    if (!lastInvitation?.url) return;

    window.location.href = buildMailtoUrl(lastInvitation);
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
              Genera una invitación segura y prepara un correo visual para enviarlo desde Gmail.
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
                  Pulsa “Preparar Gmail”, pega el contenido en el cuerpo del correo y envíalo.
                </p>
              </div>
            </div>

            <p>
              <strong>Email:</strong> {lastInvitation.email}
            </p>

            <p>
              <strong>Rol:</strong> {lastInvitation.role}
            </p>

            {emailCopied && (
              <p className="alert">
                Correo copiado. Ahora pega el contenido en Gmail y envíalo.
              </p>
            )}

            <div className="form-actions">
              <button type="button" onClick={handlePrepareGmail}>
                Preparar Gmail
              </button>

              <button type="button" onClick={handleOpenMailApp}>
                Correo simple
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