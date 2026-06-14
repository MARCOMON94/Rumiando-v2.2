const accountSettingsService = require('../services/accountSettingsService');

async function getAccountSettings(req, res, next) {
  try {
    const settings = await accountSettingsService.getAccountSettings(req.user.cuentaGanaderaId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

async function updateAccount(req, res, next) {
  try {
    const account = await accountSettingsService.updateAccount(
      req.body,
      req.user.cuentaGanaderaId
    );
    res.json(account);
  } catch (err) {
    next(err);
  }
}

async function updateFarmUnit(req, res, next) {
  try {
    const farmUnit = await accountSettingsService.updateFarmUnit(
      Number(req.params.id),
      req.body,
      req.user.cuentaGanaderaId
    );
    res.json(farmUnit);
  } catch (err) {
    next(err);
  }
}

async function updateManagedUser(req, res, next) {
  try {
    const user = await accountSettingsService.updateManagedUser(
      Number(req.params.id),
      req.body,
      req.user
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function updateCurrentUser(req, res, next) {
  try {
    const user = await accountSettingsService.updateCurrentUser(
      req.user.id,
      req.body
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function markLivestockImportPromptSeen(req, res, next) {
  try {
    const account = await accountSettingsService.markLivestockImportPromptSeen(
      req.user.cuentaGanaderaId
    );
    res.json({
      livestockImportPromptSeenAt: account.livestockImportPromptSeenAt
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAccountSettings,
  updateAccount,
  updateFarmUnit,
  updateManagedUser,
  updateCurrentUser,
  markLivestockImportPromptSeen
};
