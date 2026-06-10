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
    },
    include: {
      estadoReproductivoSugerido: true
    }
  });

  if (!pen) {
    throw new AppError('Corral destino no encontrado para esta cuenta ganadera', 404);
  }

  return pen;
}

async function checkReproductiveStatus(estadoReproductivoId, cuentaGanaderaId) {
  if (!estadoReproductivoId) {
    return null;
  }

  const status = await prisma.catalogoEstadoReproductivo.findFirst({
    where: {
      id: Number(estadoReproductivoId),
      cuentaGanaderaId
    }
  });

  if (!status) {
    throw new AppError('Estado reproductivo destino no encontrado para esta cuenta ganadera', 404);
  }

  return status;
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
    crotales,
    aplicarEstadoReproductivo,
    estadoReproductivoDestinoId
  } = data;

  if (!tipoOperacion || !unidadRegaId || !corralDestinoId || !Array.isArray(crotales)) {
    throw new AppError('tipoOperacion, unidadRegaId, corralDestinoId y crotales son obligatorios', 400);
  }

  if (crotales.length === 0) {
    throw new AppError('Debe indicarse al menos un crotal', 400);
  }

  await checkFarmUnit(unidadRegaId, user.cuentaGanaderaId);
  const destinationPen = await checkDestinationPen(corralDestinoId, user.cuentaGanaderaId);
  const reproductiveStatus = await checkReproductiveStatus(
    aplicarEstadoReproductivo
      ? estadoReproductivoDestinoId || destinationPen.estadoReproductivoSugeridoId
      : null,
    user.cuentaGanaderaId
  );

  const movementDate = fecha ? new Date(fecha) : new Date();
  const rawNormalizedEarTags = crotales.map((crotal) => normalizeEarTag(crotal)).filter(Boolean);
  const normalizedEarTags = [];
  const duplicatedEarTags = [];
  const seenEarTags = new Set();

  for (const earTag of rawNormalizedEarTags) {
    if (seenEarTags.has(earTag)) {
      duplicatedEarTags.push(earTag);
      continue;
    }

    seenEarTags.add(earTag);
    normalizedEarTags.push(earTag);
  }

  if (rawNormalizedEarTags.length === 0) {
    throw new AppError('Debe indicarse al menos un crotal valido', 400);
  }

  return prisma.$transaction(async (tx) => {
    const movement = await tx.movimientoTransaccion.create({
      data: {
        tipoOperacion,
        motivo: motivo || null,
        fecha: movementDate,
        unidadRegaId: Number(unidadRegaId),
        corralDestinoId: Number(corralDestinoId),
        userId: user.id,
        resumen: {
          totalLeidos: rawNormalizedEarTags.length,
          procesados: 0,
          noEncontrados: 0,
          yaEnDestino: 0,
          duplicadosIgnorados: duplicatedEarTags.length,
          estadoReproductivoAplicado: 0,
          estadoReproductivoDestinoId: reproductiveStatus?.id || null,
          avisos: []
        }
      }
    });

    let processedCount = 0;
    let notFoundCount = 0;
    let alreadyInDestinationCount = 0;
    let reproductiveStatusAppliedCount = 0;
    const warnings = [];

    for (const duplicatedEarTag of duplicatedEarTags) {
      await tx.movimientoAnimalDetalle.create({
        data: {
          transaccionId: movement.id,
          crotalLeido: duplicatedEarTag,
          estadoProceso: 'DUPLICADO_IGNORADO',
          corralDestinoId: Number(corralDestinoId),
          observaciones: 'Lectura duplicada ignorada'
        }
      });
    }

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

      const updateData = {
        corralActualId: Number(corralDestinoId),
        fechaEntradaCorralActual: movementDate
      };

      if (reproductiveStatus) {
        updateData.estadoReproductivoId = reproductiveStatus.id;
        updateData.fechaEstadoReproductivoActual = movementDate;
        reproductiveStatusAppliedCount++;

        if (animal.sexo === 'MACHO' && reproductiveStatus.nombre !== 'Macho') {
          warnings.push(`${animal.crotal}: macho con estado reproductivo ${reproductiveStatus.nombre}`);
        }
      }

      await tx.animal.update({
        where: {
          id: animal.id
        },
        data: updateData
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
          observaciones: reproductiveStatus
            ? `Movido a ${destinationPen.nombre}. Estado reproductivo: ${reproductiveStatus.nombre}`
            : `Movido a ${destinationPen.nombre}`
        }
      });
    }

    await tx.movimientoTransaccion.update({
      where: {
        id: movement.id
      },
      data: {
        resumen: {
          totalLeidos: rawNormalizedEarTags.length,
          procesados: processedCount,
          noEncontrados: notFoundCount,
          yaEnDestino: alreadyInDestinationCount,
          duplicadosIgnorados: duplicatedEarTags.length,
          estadoReproductivoAplicado: reproductiveStatusAppliedCount,
          estadoReproductivoDestinoId: reproductiveStatus?.id || null,
          estadoReproductivoDestinoNombre: reproductiveStatus?.nombre || null,
          avisos: warnings
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
