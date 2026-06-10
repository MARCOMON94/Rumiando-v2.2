const { OAuth2Client } = require('google-auth-library');

const AppError = require('./AppError');

let googleClient = null;

function getGoogleClient() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError('GOOGLE_CLIENT_ID no configurado', 500);
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  return googleClient;
}

async function verifyGoogleCredential(credential) {
  if (!credential) {
    throw new AppError('Credential de Google no proporcionada', 400);
  }

  const client = getGoogleClient();

  let ticket;

  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
  } catch {
    throw new AppError('Token de Google no válido', 401);
  }

  const payload = ticket.getPayload();

  if (!payload) {
    throw new AppError('Token de Google sin payload', 401);
  }

  if (!payload.sub || !payload.email) {
    throw new AppError('Token de Google incompleto', 401);
  }

  if (!payload.email_verified) {
    throw new AppError('El email de Google no está verificado', 401);
  }

  return {
    googleSub: payload.sub,
    email: payload.email.toLowerCase(),
    nombre: payload.name || payload.email,
    picture: payload.picture || null
  };
}

module.exports = {
  verifyGoogleCredential
};