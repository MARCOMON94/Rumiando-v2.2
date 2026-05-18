const farmUnitService = require('../services/farmUnitService');

async function listFarmUnits(req, res, next) {
  try {
    const farmUnits = await farmUnitService.listFarmUnits(
      req.user.cuentaGanaderaId
    );

    res.json({
      data: farmUnits,
      total: farmUnits.length
    });
  } catch (err) {
    next(err);
  }
}

async function getFarmUnitById(req, res, next) {
  try {
    const farmUnit = await farmUnitService.getFarmUnitById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(farmUnit);
  } catch (err) {
    next(err);
  }
}

async function createFarmUnit(req, res, next) {
  try {
    const farmUnit = await farmUnitService.createFarmUnit(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(farmUnit);
  } catch (err) {
    next(err);
  }
}

async function updateFarmUnit(req, res, next) {
  try {
    const farmUnit = await farmUnitService.updateFarmUnit(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(farmUnit);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listFarmUnits,
  getFarmUnitById,
  createFarmUnit,
  updateFarmUnit
};