const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const normalizeEarTag = require('../utils/normalizeEarTag');

function getAnimalInclude() {
  return {
    unidadRega: true,
    especie: true,
    raza: true,
    corralActual: true,
    estadoReproductivo: true,
    madre: {
      select: {
        id: true,
        crotal: true,
        numeroInterno: true
      }
    },
    padre: {
      select: {
        id: true,
        crotal: true,
        numeroInterno: true
      }
    }
  };
}

async function checkFarmUnit(unidadRegaId, cuentaGanaderaId) {
  const unidadRega = await prisma.unidadRega.findFirst({
    where: {
      id: Number(unidadRegaId),
      cuentaGanaderaId
    }
  });

  if (!unidadRega) {
    throw new AppError('Unidad REGA no encontrada para esta cuenta ganadera', 404);
  }

  return unidadRega;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function wantsDefinitiveEarTagFilter(filters) {
  if (filters.crotalDefinitivo === undefined) return null;
  const rawValue = String(filters.crotalDefinitivo).toLowerCase();
  if (rawValue === 'true' || rawValue === '1') return true;
  if (rawValue === 'false' || rawValue === '0') return false;
  return null;
}

function isLikelyProvisionalOffspring(animal) {
  const status = String(animal.estadoReproductivo?.nombre || '').toLowerCase();
  const origin = String(animal.origen || '').toLowerCase();
  const observations = String(animal.observaciones || '').toLowerCase();

  return status === 'lactante'
    && (
      origin.includes('nacimiento')
      || observations.includes('parto')
      || observations.includes('alta creada desde flujo')
    );
}

async function definitiveEarTagAnimalIds(cuentaGanaderaId, definitive) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT a."id"
      FROM "Animal" a
      INNER JOIN "UnidadRega" u ON u."id" = a."unidadRegaId"
      WHERE u."cuentaGanaderaId" = ${cuentaGanaderaId}
        AND a."crotalDefinitivo" = ${definitive}
    `;

    return rows.map((row) => Number(row.id)).filter(Boolean);
  } catch {
    return null;
  }
}

async function setDefinitiveEarTagRaw(animalId, definitive) {
  try {
    await prisma.$executeRaw`
      UPDATE "Animal"
      SET "crotalDefinitivo" = ${definitive}
      WHERE "id" = ${Number(animalId)}
    `;
  } catch {
    // La migracion puede no estar aplicada aun en un entorno temporal.
  }
}

async function listAnimals(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: {
      cuentaGanaderaId
    }
  };

  const definitiveFilter = wantsDefinitiveEarTagFilter(filters);
  const definitiveIds = definitiveFilter === null
    ? null
    : await definitiveEarTagAnimalIds(cuentaGanaderaId, definitiveFilter);

  if (definitiveIds) {
    where.id = {
      in: definitiveIds
    };
  }

  if (filters.search) {
    const search = String(filters.search).trim();

    where.OR = [
      {
        crotal: {
          contains: normalizeEarTag(search),
          mode: 'insensitive'
        }
      },
      {
        numeroInterno: {
          contains: search,
          mode: 'insensitive'
        }
      }
    ];
  }

  if (filters.unidadRegaId) {
    where.unidadRegaId = Number(filters.unidadRegaId);
  }

  if (filters.corralActualId) {
    where.corralActualId = Number(filters.corralActualId);
  }

  if (filters.especieId) {
    where.especieId = Number(filters.especieId);
  }

  if (filters.sexo) {
    where.sexo = filters.sexo;
  }

  if (filters.estadoRegistro) {
    where.estadoRegistro = filters.estadoRegistro;
  }

  const animals = await prisma.animal.findMany({
    where,
    include: getAnimalInclude(),
    orderBy: {
      crotal: 'asc'
    }
  });

  if (definitiveFilter !== null && !definitiveIds) {
    return animals.filter((animal) => (
      definitiveFilter ? !isLikelyProvisionalOffspring(animal) : isLikelyProvisionalOffspring(animal)
    ));
  }

  return animals;
}

async function getAnimalById(id, cuentaGanaderaId) {
  const animal = await prisma.animal.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: {
      ...getAnimalInclude(),
      hijosComoMadre: {
        select: {
          id: true,
          crotal: true,
          crotalDefinitivo: true,
          numeroInterno: true,
          sexo: true,
          fechaNacimiento: true
        }
      },
      hijosComoPadre: {
        select: {
          id: true,
          crotal: true,
          crotalDefinitivo: true,
          numeroInterno: true,
          sexo: true,
          fechaNacimiento: true
        }
      },
      eventosReproductivos: {
        orderBy: {
          fecha: 'desc'
        }
      },
      detallesMovimiento: {
        include: {
          transaccion: true,
          corralOrigen: true,
          corralDestino: true
        }
      },
      casosSanitarios: {
        include: {
          enfermedad: true
        },
        orderBy: {
          fechaInicio: 'desc'
        }
      },
      tratamientos: {
        orderBy: {
          fechaInicio: 'desc'
        }
      },
      vacunaciones: {
        orderBy: {
          fecha: 'desc'
        }
      },
      desparasitaciones: {
        orderBy: {
          fecha: 'desc'
        }
      },
      recordatorios: {
        orderBy: {
          fechaObjetivo: 'asc'
        }
      }
    }
  });

  if (!animal) {
    throw new AppError('Animal no encontrado', 404);
  }

  return animal;
}

async function createAnimal(data, cuentaGanaderaId) {
  const crotal = normalizeEarTag(data.crotal);

  if (!crotal || !data.sexo || !data.unidadRegaId || !data.especieId) {
    throw new AppError('Crotal, sexo, unidad REGA y especie son obligatorios', 400);
  }

  await checkFarmUnit(data.unidadRegaId, cuentaGanaderaId);

  const existingAnimal = await prisma.animal.findUnique({
    where: {
      unidadRegaId_crotal: {
        unidadRegaId: Number(data.unidadRegaId),
        crotal
      }
    }
  });

  if (existingAnimal) {
    throw new AppError('Ya existe un animal con ese crotal en esta unidad REGA', 409);
  }

  const animal = await prisma.animal.create({
    data: {
      crotal,
      numeroInterno: data.numeroInterno || null,
      sexo: data.sexo,
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
      fechaEntrada: data.fechaEntrada ? new Date(data.fechaEntrada) : new Date(),
      origen: data.origen || null,
      estadoRegistro: data.estadoRegistro || 'ACTIVO',
      fechaSalida: data.fechaSalida ? new Date(data.fechaSalida) : null,
      destinoSalida: data.destinoSalida || null,
      observaciones: data.observaciones || null,

      unidadRegaId: Number(data.unidadRegaId),
      especieId: Number(data.especieId),
      razaId: data.razaId ? Number(data.razaId) : null,
      corralActualId: data.corralActualId ? Number(data.corralActualId) : null,
      fechaEntradaCorralActual: data.fechaEntradaCorralActual
        ? new Date(data.fechaEntradaCorralActual)
        : data.corralActualId ? new Date() : null,
      estadoReproductivoId: data.estadoReproductivoId
        ? Number(data.estadoReproductivoId)
        : null,
      madreId: data.madreId ? Number(data.madreId) : null,
      padreId: data.padreId ? Number(data.padreId) : null
    },
    include: getAnimalInclude()
  });

  if (data.crotalDefinitivo !== undefined) {
    await setDefinitiveEarTagRaw(animal.id, parseBoolean(data.crotalDefinitivo));
    return getAnimalById(animal.id, cuentaGanaderaId);
  }

  return animal;
}

async function updateAnimal(id, data, cuentaGanaderaId) {
  const currentAnimal = await getAnimalById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.crotal !== undefined) {
    updateData.crotal = normalizeEarTag(data.crotal);
  }

  if (data.numeroInterno !== undefined) {
    updateData.numeroInterno = data.numeroInterno || null;
  }

  if (data.sexo !== undefined) {
    updateData.sexo = data.sexo;
  }

  if (data.fechaNacimiento !== undefined) {
    updateData.fechaNacimiento = data.fechaNacimiento
      ? new Date(data.fechaNacimiento)
      : null;
  }

  if (data.fechaEntrada !== undefined) {
    updateData.fechaEntrada = data.fechaEntrada
      ? new Date(data.fechaEntrada)
      : new Date();
  }

  if (data.origen !== undefined) {
    updateData.origen = data.origen || null;
  }

  if (data.estadoRegistro !== undefined) {
    updateData.estadoRegistro = data.estadoRegistro;
  }

  if (data.fechaSalida !== undefined) {
    updateData.fechaSalida = data.fechaSalida
      ? new Date(data.fechaSalida)
      : null;
  }

  if (data.destinoSalida !== undefined) {
    updateData.destinoSalida = data.destinoSalida || null;
  }

  if (data.observaciones !== undefined) {
    updateData.observaciones = data.observaciones || null;
  }

  if (data.unidadRegaId !== undefined) {
    await checkFarmUnit(data.unidadRegaId, cuentaGanaderaId);
    updateData.unidadRegaId = Number(data.unidadRegaId);
  }

  if (data.especieId !== undefined) {
    updateData.especieId = Number(data.especieId);
  }

  if (data.razaId !== undefined) {
    updateData.razaId = data.razaId ? Number(data.razaId) : null;
  }

  if (data.corralActualId !== undefined) {
    updateData.corralActualId = data.corralActualId
      ? Number(data.corralActualId)
      : null;
  }

  if (data.fechaEntradaCorralActual !== undefined) {
    updateData.fechaEntradaCorralActual = data.fechaEntradaCorralActual
      ? new Date(data.fechaEntradaCorralActual)
      : null;
  }

  if (data.estadoReproductivoId !== undefined) {
    updateData.estadoReproductivoId = data.estadoReproductivoId
      ? Number(data.estadoReproductivoId)
      : null;
  }

  if (data.fechaEstadoReproductivoActual !== undefined) {
    updateData.fechaEstadoReproductivoActual = data.fechaEstadoReproductivoActual
      ? new Date(data.fechaEstadoReproductivoActual)
      : null;
  }

  if (data.madreId !== undefined) {
    updateData.madreId = data.madreId ? Number(data.madreId) : null;
  }

  if (data.padreId !== undefined) {
    updateData.padreId = data.padreId ? Number(data.padreId) : null;
  }

  if (updateData.crotal) {
    const duplicatedAnimal = await prisma.animal.findFirst({
      where: {
        crotal: updateData.crotal,
        unidadRegaId: updateData.unidadRegaId || currentAnimal.unidadRegaId,
        NOT: {
          id
        }
      }
    });

    if (duplicatedAnimal) {
      throw new AppError('Ya existe otro animal con ese crotal en esta unidad REGA', 409);
    }
  }

  if (updateData.estadoRegistro === 'BAJA') {
    const dischargedAnimal = await prisma.$transaction(async (tx) => {
      const animal = await tx.animal.update({
        where: {
          id
        },
        data: updateData,
        include: getAnimalInclude()
      });

      await tx.animalWatchlistItem.deleteMany({
        where: {
          animalId: id,
          cuentaGanaderaId
        }
      });

      await tx.recordatorio.updateMany({
        where: {
          animalId: id,
          cuentaGanaderaId,
          estado: {
            in: ['PENDIENTE', 'POSPUESTO']
          }
        },
        data: {
          estado: 'CANCELADO',
          pospuestoHasta: null
        }
      });

      return animal;
    });

    if (data.crotalDefinitivo !== undefined) {
      await setDefinitiveEarTagRaw(id, parseBoolean(data.crotalDefinitivo));
      return getAnimalById(id, cuentaGanaderaId);
    }

    return dischargedAnimal;
  }

  const updatedAnimal = await prisma.animal.update({
    where: {
      id
    },
    data: updateData,
    include: getAnimalInclude()
  });

  if (data.crotalDefinitivo !== undefined) {
    await setDefinitiveEarTagRaw(updatedAnimal.id, parseBoolean(data.crotalDefinitivo));
    return getAnimalById(updatedAnimal.id, cuentaGanaderaId);
  }

  return updatedAnimal;
}

module.exports = {
  listAnimals,
  getAnimalById,
  createAnimal,
  updateAnimal
};
