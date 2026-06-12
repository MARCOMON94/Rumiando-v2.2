const crypto = require('crypto');

const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { verifyGoogleCredential } = require('../utils/googleAuth');
const { sendInvitationEmail } = require('./emailService');

const INVITATION_EXPIRATION_DAYS = 7;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getFrontendUrl() {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  return frontendUrl.replace(/\/+$/, '');
}

function buildInvitationUrl(token) {
  return `${getFrontendUrl()}/invite/${token}`;
}

async function createInvitation(data, adminUser) {
  const email = normalizeEmail(data.email);
  const role = data.rol || data.role || 'OPERARIO';

  if (!adminUser || adminUser.rol !== 'ADMIN') {
    throw new AppError('Solo un administrador puede crear invitaciones', 403);
  }

  if (!email) {
    throw new AppError('El email es obligatorio', 400);
  }

  if (!['ADMIN', 'OPERARIO'].includes(role)) {
    throw new AppError('Rol de invitación no válido', 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email
    }
  });

  if (existingUser) {
    throw new AppError('Ya existe un usuario con ese email', 409);
  }

  const existingPendingInvitation = await prisma.invitation.findFirst({
    where: {
      email,
      cuentaGanaderaId: adminUser.cuentaGanaderaId,
      status: 'PENDING',
      expiresAt: {
        gt: new Date()
      }
    }
  });

  if (existingPendingInvitation) {
    throw new AppError('Ya existe una invitación pendiente para ese email', 409);
  }

  const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = addDays(new Date(), INVITATION_EXPIRATION_DAYS);
    const invitationUrl = buildInvitationUrl(token);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      rol: role,
      tokenHash,
      status: 'PENDING',
      expiresAt,
      cuentaGanaderaId: adminUser.cuentaGanaderaId,
      invitedById: adminUser.id
    },
    include: {
      cuentaGanadera: true,
      invitedBy: {
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true
        }
      }
    }
  });

  const emailResult = await sendInvitationEmail({
  to: email,
  invitationUrl,
  role,
  farmName: invitation.cuentaGanadera?.nombre,
  invitedByName: adminUser.nombre || adminUser.email
});

return {
  invitation,
  invitationUrl,
  email: emailResult
};
}

async function validateInvitation(token) {
  if (!token) {
    throw new AppError('Token de invitación no proporcionado', 400);
  }

  const tokenHash = hashInvitationToken(token);

  const invitation = await prisma.invitation.findUnique({
    where: {
      tokenHash
    },
    include: {
      cuentaGanadera: true,
      invitedBy: {
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true
        }
      }
    }
  });

  if (!invitation) {
    throw new AppError('Invitación no encontrada', 404);
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError('La invitación ya no está disponible', 410);
  }

  if (invitation.expiresAt <= new Date()) {
    await prisma.invitation.update({
      where: {
        id: invitation.id
      },
      data: {
        status: 'EXPIRED'
      }
    });

    throw new AppError('La invitación ha caducado', 410);
  }

  return invitation;
}

async function acceptInvitationWithGoogle(data) {
  const { token, credential } = data;

  const invitation = await validateInvitation(token);
  const googleUser = await verifyGoogleCredential(credential);

  if (googleUser.email !== invitation.email) {
    throw new AppError('El email de Google no coincide con el email invitado', 403);
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: googleUser.email
    }
  });

  if (existingUser) {
    throw new AppError('Ya existe un usuario con ese email', 409);
  }

  const user = await prisma.user.create({
    data: {
      nombre: googleUser.nombre,
      email: googleUser.email,
      googleSub: googleUser.googleSub,
      authProvider: 'GOOGLE',
      rol: invitation.rol,
      activo: true,
      cuentaGanaderaId: invitation.cuentaGanaderaId
    },
    include: {
      cuentaGanadera: true
    }
  });

  const updatedInvitation = await prisma.invitation.update({
    where: {
      id: invitation.id
    },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      acceptedByUserId: user.id
    }
  });

  return {
    user,
    invitation: updatedInvitation
  };
}

async function listInvitations(adminUser) {
  if (!adminUser || adminUser.rol !== 'ADMIN') {
    throw new AppError('Solo un administrador puede consultar invitaciones', 403);
  }

  return prisma.invitation.findMany({
    where: {
      cuentaGanaderaId: adminUser.cuentaGanaderaId
    },
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      invitedBy: {
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true
        }
      },
      acceptedByUser: {
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true
        }
      }
    }
  });
}

async function cancelInvitation(invitationId, adminUser) {
  if (!adminUser || adminUser.rol !== 'ADMIN') {
    throw new AppError('Solo un administrador puede cancelar invitaciones', 403);
  }

  const id = Number(invitationId);

  if (!Number.isInteger(id)) {
    throw new AppError('ID de invitación no válido', 400);
  }

  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      cuentaGanaderaId: adminUser.cuentaGanaderaId
    }
  });

  if (!invitation) {
    throw new AppError('Invitación no encontrada', 404);
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError('Solo se pueden cancelar invitaciones pendientes', 400);
  }

  await prisma.invitation.delete({
    where: {
      id: invitation.id
    }
  });

  return invitation;
}

module.exports = {
  createInvitation,
  validateInvitation,
  acceptInvitationWithGoogle,
  listInvitations,
  cancelInvitation
};