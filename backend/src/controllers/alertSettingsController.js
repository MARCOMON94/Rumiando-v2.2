const alertSettingsService = require('../services/alertSettingsService');

async function listAlertSettings(req, res, next) {
  try {
    const settings = await alertSettingsService.listAlertSettings(req.user.cuentaGanaderaId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

async function upsertAlertSettings(req, res, next) {
  try {
    const settings = await alertSettingsService.upsertAlertSettings(
      req.user.cuentaGanaderaId,
      req.params.unidadRegaId,
      req.body
    );
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAlertSettings,
  upsertAlertSettings
};
