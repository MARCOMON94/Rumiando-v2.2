const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function safeUserSelect() {
  return {
    id: true,
    nombre: true,
    email: true,
    rol: true,
    activo: true,
    authProvider: true,
    createdAt: true,
    updatedAt: true
  };
}

function accountInclude() {
  return {
    unidadesRega: {
      include: {
        especiePrincipal: true,
        razaPrincipal: {
          include: {
            especie: true
          }
        }
      },
      orderBy: {
        nombre: 'asc'
      }
    },
    especies: {
      where: {
        activo: true
      },
      orderBy: {
        nombre: 'asc'
      }
    },
    razas: {
      where: {
        activo: true
      },
      include: {
        especie: true
      },
      orderBy: {
        nombre: 'asc'
      }
    },
    usuarios: {
      select: safeUserSelect(),
      orderBy: {
        nombre: 'asc'
      }
    }
  };
}

async function getAccountSettings(cuentaGanaderaId) {
  const account = await prisma.cuentaGanadera.findUnique({
    where: {
      id: cuentaGanaderaId
    },
    include: accountInclude()
  });

  if (!account) {
    throw new AppError('Cuenta ganadera no encontrada', 404);
  }

  return account;
}

async function updateAccount(data, cuentaGanaderaId) {
  const updateData = {};

  if (data.nombre !== undefined) {
    const name = String(data.nombre || '').trim();
    if (!name) throw new AppError('El nombre de explotación es obligatorio', 400);
    updateData.nombre = name;
  }

  if (data.titularNombre !== undefined) {
    updateData.titularNombre = data.titularNombre ? String(data.titularNombre).trim() : null;
  }

  if (data.telefono !== undefined) {
    updateData.telefono = data.telefono ? String(data.telefono).trim() : null;
  }

  if (data.emailContacto !== undefined) {
    updateData.emailContacto = data.emailContacto ? String(data.emailContacto).trim().toLowerCase() : null;
  }

  return prisma.cuentaGanadera.update({
    where: {
      id: cuentaGanaderaId
    },
    data: updateData,
    include: accountInclude()
  });
}

async function checkSpecies(especieId, cuentaGanaderaId) {
  if (!especieId) return null;

  const species = await prisma.catalogoEspecie.findFirst({
    where: {
      id: Number(especieId),
      cuentaGanaderaId,
      activo: true
    }
  });

  if (!species) {
    throw new AppError('La especie indicada no existe en esta cuenta', 404);
  }

  return species;
}

async function checkBreed(razaId, especieId, cuentaGanaderaId) {
  if (!razaId) return null;

  const breed = await prisma.catalogoRaza.findFirst({
    where: {
      id: Number(razaId),
      cuentaGanaderaId,
      activo: true
    }
  });

  if (!breed) {
    throw new AppError('La raza indicada no existe en esta cuenta', 404);
  }

  if (especieId && breed.especieId !== Number(especieId)) {
    throw new AppError('La raza no pertenece a la especie seleccionada', 400);
  }

  return breed;
}

async function updateFarmUnit(id, data, cuentaGanaderaId) {
  const current = await prisma.unidadRega.findFirst({
    where: {
      id,
      cuentaGanaderaId
    }
  });

  if (!current) {
    throw new AppError('Unidad REGA no encontrada', 404);
  }

  const updateData = {};

  if (data.nombre !== undefined) {
    const name = String(data.nombre || '').trim();
    if (!name) throw new AppError('El nombre de la REGA es obligatorio', 400);
    updateData.nombre = name;
  }

  if (data.codigoRega !== undefined) {
    const code = String(data.codigoRega || '').trim();
    if (!code) throw new AppError('El número REGA es obligatorio', 400);
    updateData.codigoRega = code;

    const duplicated = await prisma.unidadRega.findFirst({
      where: {
        codigoRega: code,
        cuentaGanaderaId,
        NOT: {
          id
        }
      }
    });

    if (duplicated) {
      throw new AppError('Ya existe otra unidad con ese número REGA', 409);
    }
  }

  if (data.especiePrincipalId !== undefined) {
    await checkSpecies(data.especiePrincipalId, cuentaGanaderaId);
    updateData.especiePrincipalId = data.especiePrincipalId ? Number(data.especiePrincipalId) : null;
  }

  if (data.razaPrincipalId !== undefined) {
    const finalSpeciesId = updateData.especiePrincipalId !== undefined
      ? updateData.especiePrincipalId
      : current.especiePrincipalId;
    await checkBreed(data.razaPrincipalId, finalSpeciesId, cuentaGanaderaId);
    updateData.razaPrincipalId = data.razaPrincipalId ? Number(data.razaPrincipalId) : null;
  }

  return prisma.unidadRega.update({
    where: {
      id
    },
    data: updateData,
    include: {
      especiePrincipal: true,
      razaPrincipal: true
    }
  });
}

async function ensureAdminCanChangeUser(targetUser, data, actorUser) {
  const willDeactivate = data.activo === false;
  const willLoseAdmin = data.rol && data.rol !== 'ADMIN';

  if (targetUser.id === actorUser.id && (willDeactivate || willLoseAdmin)) {
    throw new AppError('No puedes quitarte permisos de administrador a ti mismo', 400);
  }

  if (targetUser.rol !== 'ADMIN') return;
  if (!willDeactivate && !willLoseAdmin) return;

  const activeAdmins = await prisma.user.count({
    where: {
      cuentaGanaderaId: actorUser.cuentaGanaderaId,
      rol: 'ADMIN',
      activo: true,
      NOT: {
        id: targetUser.id
      }
    }
  });

  if (activeAdmins === 0) {
    throw new AppError('La cuenta debe conservar al menos un administrador activo', 400);
  }
}

async function updateManagedUser(id, data, actorUser) {
  const targetUser = await prisma.user.findFirst({
    where: {
      id,
      cuentaGanaderaId: actorUser.cuentaGanaderaId
    }
  });

  if (!targetUser) {
    throw new AppError('Usuario no encontrado en esta cuenta', 404);
  }

  await ensureAdminCanChangeUser(targetUser, data, actorUser);

  const updateData = {};

  if (data.nombre !== undefined) {
    const name = String(data.nombre || '').trim();
    if (!name) throw new AppError('El nombre del usuario es obligatorio', 400);
    updateData.nombre = name;
  }

  if (data.rol !== undefined) {
    if (!['ADMIN', 'OPERARIO'].includes(data.rol)) {
      throw new AppError('Rol de usuario no válido', 400);
    }
    updateData.rol = data.rol;
  }

  if (data.activo !== undefined) {
    updateData.activo = Boolean(data.activo);
  }

  return prisma.user.update({
    where: {
      id
    },
    data: updateData,
    select: safeUserSelect()
  });
}

async function updateCurrentUser(id, data) {
  const updateData = {};

  if (data.nombre !== undefined) {
    const name = String(data.nombre || '').trim();
    if (!name) throw new AppError('El nombre es obligatorio', 400);
    updateData.nombre = name;
  }

  const user = await prisma.user.update({
    where: {
      id
    },
    data: updateData,
    include: {
      cuentaGanadera: true
    }
  });

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function markLivestockImportPromptSeen(cuentaGanaderaId) {
  return prisma.cuentaGanadera.update({
    where: {
      id: cuentaGanaderaId
    },
    data: {
      livestockImportPromptSeenAt: new Date()
    }
  });
}

module.exports = {
  getAccountSettings,
  updateAccount,
  updateFarmUnit,
  updateManagedUser,
  updateCurrentUser,
  markLivestockImportPromptSeen
};
