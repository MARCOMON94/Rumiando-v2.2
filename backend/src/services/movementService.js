const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const normalizeEarTag = require('../utils/normalizeEarTag');

function getMovementInclude() {
  return {
    unidadRega: true,
    corralOrigen: true,
    corralDestino: true,
    user: {
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true
      }
    },
    detalles: {
      include: {
        animal: {
          include: {
            especie: true,
            raza: true
          }
        },
        corralOrigen: true,
        corralDestino: true
      },
      orderBy: {
        id: 'asc'
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

async function checkDestinationPen(corralDestinoId, cuentaGanaderaId) {
  const pen = await prisma.corral.findFirst({
    where: {
      id: Number(corralDestinoId),
      unidadRega: {
        cuentaGanaderaId
      }
    }
  });

  if (!pen) {
    throw new AppError('Corral destino no encontrado para esta cuenta ganadera', 404);
  }

  return pen;
}

async function listMovements(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: {
      cuentaGanaderaId
    }
  };

  if (filters.unidadRegaId) {
    where.unidadRegaId = Number(filters.unidadRegaId);
  }

  if (filters.corralDestinoId) {
    where.corralDestinoId = Number(filters.corralDestinoId);
  }

  if (filters.tipoOperacion) {
    where.tipoOperacion = filters.tipoOperacion;
  }

  return prisma.movimientoTransaccion.findMany({
    where,
    include: {
      unidadRega: true,
      corralOrigen: true,
      corralDestino: true,
      user: {
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: true
        }
      },
      detalles: true
    },
    orderBy: {
      fecha: 'desc'
    }
  });
}

async function getMovementById(id, cuentaGanaderaId) {
  const movement = await prisma.movimientoTransaccion.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: getMovementInclude()
  });

  if (!movement) {
    throw new AppError('Movimiento no encontrado', 404);
  }

  return movement;
}

async function createMovement(data, user) {
  const {
    tipoOperacion,
    motivo,
    fecha,
    unidadRegaId,
    corralDestinoId,
    crotales
  } = data;

  if (!tipoOperacion || !unidadRegaId || !corralDestinoId || !Array.isArray(crotales)) {
    throw new AppError('tipoOperacion, unidadRegaId, corralDestinoId y crotales son obligatorios', 400);
  }

  if (crotales.length === 0) {
    throw new AppError('Debe indicarse al menos un crotal', 400);
  }

  await checkFarmUnit(unidadRegaId, user.cuentaGanaderaId);
  const destinationPen = await checkDestinationPen(corralDestinoId, user.cuentaGanaderaId);

  const normalizedEarTags = crotales.map((crotal) => normalizeEarTag(crotal));

  return prisma.$transaction(async (tx) => {
    const movement = await tx.movimientoTransaccion.create({
      data: {
        tipoOperacion,
        motivo: motivo || null,
        fecha: fecha ? new Date(fecha) : new Date(),
        unidadRegaId: Number(unidadRegaId),
        corralDestinoId: Number(corralDestinoId),
        userId: user.id,
        resumen: {
          totalLeidos: normalizedEarTags.length,
          procesados: 0,
          noEncontrados: 0,
          yaEnDestino: 0
        }
      }
    });

    let processedCount = 0;
    let notFoundCount = 0;
    let alreadyInDestinationCount = 0;

    for (const earTag of normalizedEarTags) {
      const animal = await tx.animal.findUnique({
        where: {
          unidadRegaId_crotal: {
            unidadRegaId: Number(unidadRegaId),
            crotal: earTag
          }
        }
      });

      if (!animal) {
        notFoundCount++;

        await tx.movimientoAnimalDetalle.create({
          data: {
            transaccionId: movement.id,
            crotalLeido: earTag,
            estadoProceso: 'NO_ENCONTRADO',
            corralDestinoId: Number(corralDestinoId),
            observaciones: 'Animal no encontrado en la unidad REGA indicada'
          }
        });

        continue;
      }

      if (animal.corralActualId === Number(corralDestinoId)) {
        alreadyInDestinationCount++;

        await tx.movimientoAnimalDetalle.create({
          data: {
            transaccionId: movement.id,
            crotalLeido: earTag,
            estadoProceso: 'YA_EN_DESTINO',
            animalId: animal.id,
            corralOrigenId: animal.corralActualId,
            corralDestinoId: Number(corralDestinoId),
            observaciones: 'El animal ya estaba en el corral destino'
          }
        });

        continue;
      }

      await tx.animal.update({
        where: {
          id: animal.id
        },
        data: {
          corralActualId: Number(corralDestinoId)
        }
      });

      processedCount++;

      await tx.movimientoAnimalDetalle.create({
        data: {
          transaccionId: movement.id,
          crotalLeido: earTag,
          estadoProceso: 'PROCESADO',
          animalId: animal.id,
          corralOrigenId: animal.corralActualId,
          corralDestinoId: Number(corralDestinoId),
          observaciones: `Movido a ${destinationPen.nombre}`
        }
      });
    }

    await tx.movimientoTransaccion.update({
      where: {
        id: movement.id
      },
      data: {
        resumen: {
          totalLeidos: normalizedEarTags.length,
          procesados: processedCount,
          noEncontrados: notFoundCount,
          yaEnDestino: alreadyInDestinationCount
        }
      }
    });

    return tx.movimientoTransaccion.findUnique({
      where: {
        id: movement.id
      },
      include: getMovementInclude()
    });
  });
}

module.exports = {
  listMovements,
  getMovementById,
  createMovement
};