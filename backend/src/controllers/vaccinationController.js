const vaccinationService = require('../services/vaccinationService');

async function listVaccinations(req, res, next) {
  try {
    const vaccinations = await vaccinationService.listVaccinations(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: vaccinations,
      total: vaccinations.length
    });
  } catch (err) {
    next(err);
  }
}

async function getVaccinationById(req, res, next) {
  try {
    const vaccination = await vaccinationService.getVaccinationById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(vaccination);
  } catch (err) {
    next(err);
  }
}

async function createVaccination(req, res, next) {
  try {
    const vaccination = await vaccinationService.createVaccination(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(vaccination);
  } catch (err) {
    next(err);
  }
}

async function updateVaccination(req, res, next) {
  try {
    const vaccination = await vaccinationService.updateVaccination(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(vaccination);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVaccinations,
  getVaccinationById,
  createVaccination,
  updateVaccination
};