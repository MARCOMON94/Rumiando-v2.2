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

async function normalizeSanitaryTerm(req, res, next) {
  try {
    const result = await catalogService.normalizeSanitaryTerm(
      req.body,
      req.user.cuentaGanaderaId,
      req.headers.authorization
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCatalogs,
  normalizeSanitaryTerm
};
