const AppError = require('../utils/AppError');

function integrationApiKeyMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return next(new AppError('API key de integración no proporcionada', 401));
  }

  if (apiKey !== process.env.N8N_API_KEY) {
    return next(new AppError('API key de integración no válida', 401));
  }

  next();
}

module.exports = integrationApiKeyMiddleware;