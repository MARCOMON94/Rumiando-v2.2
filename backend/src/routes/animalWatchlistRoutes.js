const express = require('express');

const animalWatchlistController = require('../controllers/animalWatchlistController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, animalWatchlistController.listItems);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  animalWatchlistController.addItem
);

router.post(
  '/read',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  animalWatchlistController.markRead
);

router.delete(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  animalWatchlistController.clearItems
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  animalWatchlistController.deleteItem
);

module.exports = router;
