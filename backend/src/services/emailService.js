function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true';
}

function hasBrevoConfig() {
  return Boolean(
    process.env.BREVO_API_KEY &&
    process.env.EMAIL_FROM_ADDRESS
  );
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

function buildInvitationText({
  invitationUrl,
  invitedEmail,
  role,
  farmName,
  invitedByName
}) {
  const displayFarmName = farmName || 'RumiAndo';
  const displayInvitedByName = invitedByName || 'Un administrador';

  return [
    'RumiAndo - Gestión ganadera',
    '',
    'Invitación de acceso',
    '',
    'Hola,',
    '',
    `${displayInvitedByName} te ha invitado a acceder a ${displayFarmName} en RumiAndo.`,
    '',
    `Email invitado: ${invitedEmail}`,
    `Rol asignado: ${role || 'OPERARIO'}`,
    '',
    'Para aceptar la invitación, abre este enlace y entra con la misma cuenta de Google:',
    invitationUrl,
    '',
    'Esta invitación es personal y caduca automáticamente.',
    '',
    'Si no esperabas esta invitación, puedes ignorar este correo.',
    '',
    'Un saludo,',
    'Equipo RumiAndo'
  ].join('\n');
}

function buildInvitationHtml({
  invitationUrl,
  invitedEmail,
  role,
  farmName,
  invitedByName
}) {
  const safeFarmName = escapeHtml(farmName || 'RumiAndo');
  const safeInvitedByName = escapeHtml(invitedByName || 'Un administrador');
  const safeInvitedEmail = escapeHtml(invitedEmail);
  const safeRole = escapeHtml(role || 'OPERARIO');
  const safeInvitationUrl = escapeHtml(invitationUrl);

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
              ${safeInvitedByName} te ha invitado a acceder a <strong>${safeFarmName}</strong> en RumiAndo.
            </p>

            <div style="margin:22px 0;padding:18px 20px;background:#f4f7f1;border:1px solid #dfe8dc;border-radius:18px;">
              <p style="margin:0 0 8px;color:#33443a;font-size:15px;line-height:1.45;">
                <strong>Email invitado:</strong> ${safeInvitedEmail}
              </p>
              <p style="margin:0;color:#33443a;font-size:15px;line-height:1.45;">
                <strong>Rol asignado:</strong> ${safeRole}
              </p>
            </div>

            <p style="margin:0 0 24px;color:#33443a;font-size:16px;line-height:1.55;">
              Para aceptar la invitación, pulsa el botón y entra con la misma cuenta de Google indicada arriba.
            </p>

            <div style="text-align:center;margin:30px 0 28px;">
              <a href="${safeInvitationUrl}" style="display:inline-block;background:#3f6b4b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 28px;border-radius:999px;box-shadow:0 12px 24px rgba(63,107,75,0.22);">
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

async function sendInvitationEmail({
  to,
  invitationUrl,
  role,
  farmName,
  invitedByName
}) {
  if (!isEmailEnabled()) {
    return {
      sent: false,
      reason: 'EMAIL_DISABLED'
    };
  }

  if (!hasBrevoConfig()) {
    return {
      sent: false,
      reason: 'EMAIL_NOT_CONFIGURED'
    };
  }

  const payload = {
    sender: {
      name: process.env.EMAIL_FROM_NAME || 'RumiAndo',
      email: process.env.EMAIL_FROM_ADDRESS
    },
    to: [
      {
        email: to
      }
    ],
    subject: buildInvitationSubject({ farmName }),
    htmlContent: buildInvitationHtml({
      invitationUrl,
      invitedEmail: to,
      role,
      farmName,
      invitedByName
    }),
    textContent: buildInvitationText({
      invitationUrl,
      invitedEmail: to,
      role,
      farmName,
      invitedByName
    })
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    let responseData = null;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText;
    }

    if (!response.ok) {
      console.error('[emailService] Brevo error:', response.status, responseData);

      return {
        sent: false,
        provider: 'brevo',
        reason: 'EMAIL_PROVIDER_ERROR',
        status: response.status,
        error: responseData
      };
    }

    return {
      sent: true,
      provider: 'brevo',
      messageId: responseData?.messageId || null
    };
  } catch (error) {
    console.error('[emailService] Error enviando email:', error);

    return {
      sent: false,
      provider: 'brevo',
      reason: 'EMAIL_REQUEST_FAILED',
      error: error.message
    };
  }
}

module.exports = {
  sendInvitationEmail
};