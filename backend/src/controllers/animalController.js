const animalService = require('../services/animalService');

async function listAnimals(req, res, next) {
  try {
    const animals = await animalService.listAnimals(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: animals,
      total: animals.length
    });
  } catch (err) {
    next(err);
  }
}

async function getAnimalById(req, res, next) {
  try {
    const animal = await animalService.getAnimalById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(animal);
  } catch (err) {
    next(err);
  }
}

async function createAnimal(req, res, next) {
  try {
    const animal = await animalService.createAnimal(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(animal);
  } catch (err) {
    next(err);
  }
}

async function updateAnimal(req, res, next) {
  try {
    const animal = await animalService.updateAnimal(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(animal);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAnimals,
  getAnimalById,
  createAnimal,
  updateAnimal
};