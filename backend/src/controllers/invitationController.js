const jwt = require('jsonwebtoken');

const invitationService = require('../services/invitationService');
const { setSessionCookie } = require('../utils/sessionCookie');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
      cuentaGanaderaId: user.cuentaGanaderaId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  );
}

function removeSensitiveInvitationFields(invitation) {
  if (!invitation) return null;

  const { tokenHash, ...safeInvitation } = invitation;
  return safeInvitation;
}

async function createInvitation(req, res, next) {
  try {
    const result = await invitationService.createInvitation(req.body, req.user);

    res.status(201).json({
      message: 'Invitación creada correctamente',
      invitation: removeSensitiveInvitationFields(result.invitation),
      invitationUrl: result.invitationUrl
    });
  } catch (err) {
    next(err);
  }
}

async function validateInvitation(req, res, next) {
  try {
    const invitation = await invitationService.validateInvitation(req.params.token);

    res.json({
      invitation: removeSensitiveInvitationFields(invitation)
    });
  } catch (err) {
    next(err);
  }
}

async function acceptInvitationWithGoogle(req, res, next) {
  try {
    const result = await invitationService.acceptInvitationWithGoogle(req.body);

    const token = generateToken(result.user);
    setSessionCookie(res, token);

    res.status(201).json({
      message: 'Invitación aceptada correctamente',
      user: result.user,
      invitation: removeSensitiveInvitationFields(result.invitation)
    });
  } catch (err) {
    next(err);
  }
}

async function listInvitations(req, res, next) {
  try {
    const invitations = await invitationService.listInvitations(req.user);

    res.json({
      invitations: invitations.map(removeSensitiveInvitationFields)
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createInvitation,
  validateInvitation,
  acceptInvitationWithGoogle,
  listInvitations
};