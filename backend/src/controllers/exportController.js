const exportService = require('../services/exportService');

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  res.send(csv);
}

async function exportAnimals(req, res, next) {
  try {
    const csv = await exportService.exportAnimals(
      req.user.cuentaGanaderaId,
      req.query
    );

    sendCsv(res, 'rumiando_animales.csv', csv);
  } catch (err) {
    next(err);
  }
}

async function exportHealthCases(req, res, next) {
  try {
    const csv = await exportService.exportHealthCases(
      req.user.cuentaGanaderaId,
      req.query
    );

    sendCsv(res, 'rumiando_casos_sanitarios.csv', csv);
  } catch (err) {
    next(err);
  }
}

async function exportMovements(req, res, next) {
  try {
    const csv = await exportService.exportMovements(
      req.user.cuentaGanaderaId,
      req.query
    );

    sendCsv(res, 'rumiando_movimientos.csv', csv);
  } catch (err) {
    next(err);
  }
}

async function exportReminders(req, res, next) {
  try {
    const csv = await exportService.exportReminders(
      req.user.cuentaGanaderaId,
      req.query
    );

    sendCsv(res, 'rumiando_recordatorios.csv', csv);
  } catch (err) {
    next(err);
  }
}

async function sendExportRequest(req, res, next) {
  try {
    const exportRequest = await exportService.sendExportRequest(
      req.user.cuentaGanaderaId,
      req.body
    );

    res.status(201).json(exportRequest);
  } catch (err) {
    next(err);
  }
}


module.exports = {
  exportAnimals,
  exportHealthCases,
  exportMovements,
  exportReminders,
  sendExportRequest
};
