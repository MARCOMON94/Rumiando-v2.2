const analyticsService = require('../services/analyticsService');

async function getOptions(req, res, next) {
  try {
    const options = await analyticsService.getOptions(req.user.cuentaGanaderaId);
    res.json(options);
  } catch (err) {
    next(err);
  }
}

async function query(req, res, next) {
  try {
    const result = await analyticsService.query(req.user.cuentaGanaderaId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const { buffer, filename } = await analyticsService.buildExcel(req.user.cuentaGanaderaId, req.body);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportEmail(req, res, next) {
  try {
    const result = await analyticsService.sendExcelEmail(req.user.cuentaGanaderaId, req.body);
    res.status(result.sent ? 200 : 202).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOptions,
  query,
  exportExcel,
  exportEmail
};
