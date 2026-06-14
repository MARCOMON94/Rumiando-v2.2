const express = require('express');

const accountSettingsController = require('../controllers/accountSettingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  accountSettingsController.getAccountSettings
);

router.put(
  '/account',
  authMiddleware,
  roleMiddleware('ADMIN'),
  accountSettingsController.updateAccount
);

router.put(
  '/farm-units/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  accountSettingsController.updateFarmUnit
);

router.put(
  '/users/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  accountSettingsController.updateManagedUser
);

router.put('/me', authMiddleware, accountSettingsController.updateCurrentUser);

router.put(
  '/onboarding/livestock-import-seen',
  authMiddleware,
  roleMiddleware('ADMIN'),
  accountSettingsController.markLivestockImportPromptSeen
);

module.exports = router;
