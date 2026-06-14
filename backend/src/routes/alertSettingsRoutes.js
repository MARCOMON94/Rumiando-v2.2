const express = require('express');

const alertSettingsController = require('../controllers/alertSettingsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, alertSettingsController.listAlertSettings);

router.put(
  '/:unidadRegaId',
  authMiddleware,
  roleMiddleware('ADMIN'),
  alertSettingsController.upsertAlertSettings
);

module.exports = router;
