const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { readSessionToken } = require('../utils/sessionCookie');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.split(' ')[1];
}

function authMiddleware(req, res, next) {
  const token = readSessionToken(req) || getBearerToken(req);

  if (!token) {
    return next(new AppError('Token no proporcionado', 401));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = payload;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expirado', 401));
    }

    return next(new AppError('Token no válido', 401));
  }
}

module.exports = authMiddleware;