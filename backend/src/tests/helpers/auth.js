const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { getSessionCookieName } = require('../../utils/sessionCookie');

async function getAdminUser() {
  let user = await prisma.user.findFirst({
    where: {
      email: 'admin@rumiando.com',
      activo: true
    }
  });

  if (user) {
    return user;
  }

  const account = await prisma.cuentaGanadera.create({
    data: {
      nombre: 'Cuenta test RumiAndo',
      titularNombre: 'Admin Test',
      emailContacto: 'admin@rumiando.com'
    }
  });

  user = await prisma.user.create({
    data: {
      nombre: 'Admin Test',
      email: 'admin@rumiando.com',
      rol: 'ADMIN',
      authProvider: 'GOOGLE',
      googleSub: 'test-google-admin',
      cuentaGanaderaId: account.id
    }
  });

  return user;
}

async function authCookieForAdmin() {
  process.env.JWT_SECRET ||= 'test-secret';

  const user = await getAdminUser();
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
      cuentaGanaderaId: user.cuentaGanaderaId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  );

  return `${getSessionCookieName()}=${token}`;
}

module.exports = {
  authCookieForAdmin
};
