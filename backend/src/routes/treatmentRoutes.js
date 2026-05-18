const express = require('express');

const treatmentController = require('../controllers/treatmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, treatmentController.listTreatments);
router.get('/:id', authMiddleware, treatmentController.getTreatmentById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  treatmentController.createTreatment
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  treatmentController.updateTreatment
);

module.exports = router;