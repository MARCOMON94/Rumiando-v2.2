const express = require('express');

const healthController = require('../controllers/healthController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, healthController.listHealthCases);
router.get('/:id', authMiddleware, healthController.getHealthCaseById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  healthController.createHealthCase
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  healthController.updateHealthCase
);

module.exports = router;