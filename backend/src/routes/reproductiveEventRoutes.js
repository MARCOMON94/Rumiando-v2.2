const express = require('express');

const reproductiveEventController = require('../controllers/reproductiveEventController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, reproductiveEventController.listReproductiveEvents);
router.get('/:id', authMiddleware, reproductiveEventController.getReproductiveEventById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  reproductiveEventController.createReproductiveEvent
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  reproductiveEventController.updateReproductiveEvent
);

module.exports = router;