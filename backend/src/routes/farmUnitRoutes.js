const express = require('express');

const farmUnitController = require('../controllers/farmUnitController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, farmUnitController.listFarmUnits);
router.get('/:id', authMiddleware, farmUnitController.getFarmUnitById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  farmUnitController.createFarmUnit
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  farmUnitController.updateFarmUnit
);

module.exports = router;