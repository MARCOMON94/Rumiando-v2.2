const movementService = require('../services/movementService');

async function listMovements(req, res, next) {
  try {
    const movements = await movementService.listMovements(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: movements,
      total: movements.length
    });
  } catch (err) {
    next(err);
  }
}

async function getMovementById(req, res, next) {
  try {
    const movement = await movementService.getMovementById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(movement);
  } catch (err) {
    next(err);
  }
}

async function createMovement(req, res, next) {
  try {
    const movement = await movementService.createMovement(
      req.body,
      req.user
    );

    res.status(201).json(movement);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMovements,
  getMovementById,
  createMovement
};