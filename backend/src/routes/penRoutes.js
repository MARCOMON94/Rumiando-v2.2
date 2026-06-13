const express = require('express');

const penController = require('../controllers/penController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, penController.listPens);
router.get('/:id', authMiddleware, penController.getPenById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  penController.createPen
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN'),
  penController.updatePen
);

router.post(
  '/:id/retire',
  authMiddleware,
  roleMiddleware('ADMIN'),
  penController.retirePen
);

module.exports = router;
