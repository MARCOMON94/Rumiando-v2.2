const express = require('express');

const vaccinationController = require('../controllers/vaccinationController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, vaccinationController.listVaccinations);
router.get('/:id', authMiddleware, vaccinationController.getVaccinationById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  vaccinationController.createVaccination
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  vaccinationController.updateVaccination
);

module.exports = router;