const dashboardService = require('../services/dashboardService');

async function getDashboard(req, res, next) {
  try {
    const dashboard = await dashboardService.getDashboard(
      req.user.cuentaGanaderaId
    );

    res.json(dashboard);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard
};