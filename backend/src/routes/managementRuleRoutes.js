const express = require('express');

const managementRuleController = require('../controllers/managementRuleController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, managementRuleController.listManagementRules);
router.get('/:id', authMiddleware, managementRuleController.getManagementRuleById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  managementRuleController.createManagementRule
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  managementRuleController.updateManagementRule
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  managementRuleController.deleteManagementRule
);

module.exports = router;
