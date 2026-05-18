const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);

    res.status(201).json({
      message: 'Usuario registrado correctamente',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);

    res.json({
      message: 'Login correcto',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const user = await authService.getProfile(req.user.id);

    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getProfile
};