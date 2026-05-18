const healthService = require('../services/healthService');

async function listHealthCases(req, res, next) {
  try {
    const healthCases = await healthService.listHealthCases(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: healthCases,
      total: healthCases.length
    });
  } catch (err) {
    next(err);
  }
}

async function getHealthCaseById(req, res, next) {
  try {
    const healthCase = await healthService.getHealthCaseById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(healthCase);
  } catch (err) {
    next(err);
  }
}

async function createHealthCase(req, res, next) {
  try {
    const healthCase = await healthService.createHealthCase(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(healthCase);
  } catch (err) {
    next(err);
  }
}

async function updateHealthCase(req, res, next) {
  try {
    const healthCase = await healthService.updateHealthCase(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(healthCase);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listHealthCases,
  getHealthCaseById,
  createHealthCase,
  updateHealthCase
};