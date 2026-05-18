const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const SALT_ROUNDS = 10;

function generateToken(user) {
  return jwt.sign(
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
}

function removePassword(user) {
  if (!user) return null;

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function register(data) {
  const {
    nombre,
    email,
    password,
    rol,
    cuentaGanaderaId
  } = data;

  if (!nombre || !email || !password) {
    throw new AppError('Nombre, email y contraseña son obligatorios', 400);
  }

  if (password.length < 6) {
    throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);
  }

  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail
    }
  });

  if (existingUser) {
    throw new AppError('Ya existe un usuario con ese email', 409);
  }

  let finalFarmAccountId = cuentaGanaderaId ? Number(cuentaGanaderaId) : null;

  if (finalFarmAccountId) {
    const farmAccount = await prisma.cuentaGanadera.findUnique({
      where: {
        id: finalFarmAccountId
      }
    });

    if (!farmAccount) {
      throw new AppError('La cuenta ganadera indicada no existe', 404);
    }
  }

  if (!finalFarmAccountId) {
    const farmAccount = await prisma.cuentaGanadera.create({
      data: {
        nombre: `Cuenta ganadera de ${nombre}`,
        titularNombre: nombre,
        emailContacto: normalizedEmail
      }
    });

    finalFarmAccountId = farmAccount.id;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      nombre,
      email: normalizedEmail,
      passwordHash,
      rol: rol || 'ADMIN',
      cuentaGanaderaId: finalFarmAccountId
    },
    include: {
      cuentaGanadera: true
    }
  });

  return {
    token: generateToken(user),
    user: removePassword(user)
  };
}

async function login(data) {
  const { email, password } = data;

  if (!email || !password) {
    throw new AppError('Email y contraseña son obligatorios', 400);
  }

  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      activo: true
    },
    include: {
      cuentaGanadera: true
    }
  });

  if (!user) {
    throw new AppError('Credenciales incorrectas', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Credenciales incorrectas', 401);
  }

  return {
    token: generateToken(user),
    user: removePassword(user)
  };
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: Number(userId)
    },
    include: {
      cuentaGanadera: true
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return removePassword(user);
}

module.exports = {
  register,
  login,
  getProfile
};