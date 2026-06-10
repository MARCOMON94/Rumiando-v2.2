const express = require('express');

const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  invitationController.listInvitations
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  invitationController.createInvitation
);

router.get(
  '/validate/:token',
  invitationController.validateInvitation
);

router.post(
  '/accept-google',
  invitationController.acceptInvitationWithGoogle
);

module.exports = router;