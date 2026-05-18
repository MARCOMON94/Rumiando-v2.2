const treatmentService = require('../services/treatmentService');

async function listTreatments(req, res, next) {
  try {
    const treatments = await treatmentService.listTreatments(
      req.user.cuentaGanaderaId,
      req.query
    );

    res.json({
      data: treatments,
      total: treatments.length
    });
  } catch (err) {
    next(err);
  }
}

async function getTreatmentById(req, res, next) {
  try {
    const treatment = await treatmentService.getTreatmentById(
      Number(req.params.id),
      req.user.cuentaGanaderaId
    );

    res.json(treatment);
  } catch (err) {
    next(err);
  }
}

async function createTreatment(req, res, next) {
  try {
    const treatment = await treatmentService.createTreatment(
      req.body,
      req.user.cuentaGanaderaId
    );

    res.status(201).json(treatment);
  } catch (err) {
    next(err);
  }
}

async function updateTreatment(req, res, next) {
  try {
    const treatment = await treatmentService.updateTreatment(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );

    res.json(treatment);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTreatments,
  getTreatmentById,
  createTreatment,
  updateTreatment
};