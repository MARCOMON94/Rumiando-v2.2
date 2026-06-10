const authService = require('../services/authService');
const { setSessionCookie, clearSessionCookie } = require('../utils/sessionCookie');

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

    setSessionCookie(res, result.token);

    res.json({
      message: 'Login correcto',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    next(err);
  }
}

async function loginWithGoogle(req, res, next) {
  try {
    const result = await authService.loginWithGoogle(req.body);

    setSessionCookie(res, result.token);

    res.json({
      message: 'Login con Google correcto',
      user: result.user
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    clearSessionCookie(res);

    res.json({
      message: 'Sesión cerrada correctamente'
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

async function disabledPasswordAuth(req, res) {
  res.status(410).json({
    message: 'La autenticación por contraseña está deshabilitada. Usa Google para iniciar sesión.'
  });
}

module.exports = {
  register,
  login,
  loginWithGoogle,
  logout,
  disabledPasswordAuth,
  getProfile
};