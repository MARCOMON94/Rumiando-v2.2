const express = require('express');

const dewormingController = require('../controllers/dewormingController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, dewormingController.listDewormings);
router.get('/:id', authMiddleware, dewormingController.getDewormingById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  dewormingController.createDeworming
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  dewormingController.updateDeworming
);

module.exports = router;