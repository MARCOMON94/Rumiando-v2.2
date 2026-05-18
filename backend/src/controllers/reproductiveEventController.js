const reproductiveEventService = require('../services/reproductiveEventService');

async function listReproductiveEvents(req, res, next) {
  try {
    const reproductiveEvents = await reproductiveEventService.listReproductiveEvents(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: reproductiveEvents,
      total: reproductiveEvents.length
    });
  } catch (err) {
    next(err);
  }
}

async function getReproductiveEventById(req, res, next) {
  try {
    const reproductiveEvent = await reproductiveEventService.getReproductiveEventById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(reproductiveEvent);
  } catch (err) {
    next(err);
  }
}

async function createReproductiveEvent(req, res, next) {
  try {
    const reproductiveEvent = await reproductiveEventService.createReproductiveEvent(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(reproductiveEvent);
  } catch (err) {
    next(err);
  }
}

async function updateReproductiveEvent(req, res, next) {
  try {
    const reproductiveEvent = await reproductiveEventService.updateReproductiveEvent(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(reproductiveEvent);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listReproductiveEvents,
  getReproductiveEventById,
  createReproductiveEvent,
  updateReproductiveEvent
};