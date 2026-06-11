const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function getSessionCookieName() {
  return isProduction() ? '__Host-rumiando_session' : 'rumiando_session';
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax',
    path: '/',
    maxAge: ONE_DAY_MS
  };
}

function getClearSessionCookieOptions() {
  const { maxAge, ...options } = getSessionCookieOptions();
  return options;
}

function setSessionCookie(res, token) {
  res.cookie(getSessionCookieName(), token, getSessionCookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(getSessionCookieName(), getClearSessionCookieOptions());

  // Por si alguna vez cambiaste entre local y producción o quedó una cookie antigua.
  res.clearCookie('rumiando_session', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  });

  res.clearCookie('__Host-rumiando_session', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  });
}

function readSessionToken(req) {
  return (
    req.cookies?.[getSessionCookieName()] ||
    req.cookies?.rumiando_session ||
    req.cookies?.['__Host-rumiando_session'] ||
    null
  );
}

module.exports = {
  getSessionCookieName,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken
};
