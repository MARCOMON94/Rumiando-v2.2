const express = require('express');

const movementController = require('../controllers/movementController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, movementController.listMovements);
router.get('/:id', authMiddleware, movementController.getMovementById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  movementController.createMovement
);

module.exports = router;