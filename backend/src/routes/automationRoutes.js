const express = require('express');

const automationController = require('../controllers/automationController');
const authMiddleware = require('../middlewares/authMiddleware');
const integrationApiKeyMiddleware = require('../middlewares/integrationApiKeyMiddleware');

const router = express.Router();

router.get(
  '/daily-operational-summary/app',
  authMiddleware,
  automationController.getDailyOperationalSummaryForUser
);

router.get(
  '/daily-operational-summary',
  integrationApiKeyMiddleware,
  automationController.getDailyOperationalSummary
);

router.get(
  '/weekly-health-summary',
  integrationApiKeyMiddleware,
  automationController.getWeeklyHealthSummary
);

module.exports = router;
