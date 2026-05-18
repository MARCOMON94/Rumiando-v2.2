const catalogService = require('../services/catalogService');

async function getCatalogs(req, res, next) {
  try {
    const catalogs = await catalogService.getCatalogs(
      req.user.cuentaGanaderaId
    );

    res.json(catalogs);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCatalogs
};