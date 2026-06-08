const automationService = require('../services/automationService');

async function getDailyOperationalSummary(req, res, next) {
  try {
    const summary = await automationService.getDailyOperationalSummary(req.query);

    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getDailyOperationalSummaryForUser(req, res, next) {
  try {
    const summary = await automationService.getDailyOperationalSummary({
      cuentaGanaderaId: req.user.cuentaGanaderaId
    });

    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getWeeklyHealthSummary(req, res, next) {
  try {
    const summary = await automationService.getWeeklyHealthSummary(req.query);

    res.json(summary);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDailyOperationalSummary,
  getDailyOperationalSummaryForUser,
  getWeeklyHealthSummary
};
