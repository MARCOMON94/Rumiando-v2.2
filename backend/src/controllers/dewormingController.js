const dewormingService = require('../services/dewormingService');

async function listDewormings(req, res, next) {
  try {
    const dewormings = await dewormingService.listDewormings(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: dewormings,
      total: dewormings.length
    });
  } catch (err) {
    next(err);
  }
}

async function getDewormingById(req, res, next) {
  try {
    const deworming = await dewormingService.getDewormingById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(deworming);
  } catch (err) {
    next(err);
  }
}

async function createDeworming(req, res, next) {
  try {
    const deworming = await dewormingService.createDeworming(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(deworming);
  } catch (err) {
    next(err);
  }
}

async function updateDeworming(req, res, next) {
  try {
    const deworming = await dewormingService.updateDeworming(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(deworming);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDewormings,
  getDewormingById,
  createDeworming,
  updateDeworming
};