const express = require('express');

const animalController = require('../controllers/animalController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const router = express.Router();

router.get('/', authMiddleware, animalController.listAnimals);
router.get('/:id', authMiddleware, animalController.getAnimalById);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  animalController.createAnimal
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('ADMIN', 'OPERARIO'),
  animalController.updateAnimal
);

module.exports = router;