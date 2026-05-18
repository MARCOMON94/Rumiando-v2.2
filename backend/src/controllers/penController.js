const penService = require('../services/penService');

async function listPens(req, res, next) {
  try {
    const pens = await penService.listPens(req.user.cuentaGanaderaId);

    res.json({
      data: pens,
      total: pens.length
    });
  } catch (err) {
    next(err);
  }
}

async function getPenById(req, res, next) {
  try {
    const pen = await penService.getPenById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(pen);
  } catch (err) {
    next(err);
  }
}

async function createPen(req, res, next) {
  try {
    const pen = await penService.createPen(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(pen);
  } catch (err) {
    next(err);
  }
}

async function updatePen(req, res, next) {
  try {
    const pen = await penService.updatePen(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(pen);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPens,
  getPenById,
  createPen,
  updatePen
};