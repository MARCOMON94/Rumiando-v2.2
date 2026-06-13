const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getPenInclude() {
  return {
    unidadRega: true,
    estadoReproductivoSugerido: true,
    _count: {
      select: {
        animalesActuales: true
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
    throw new AppError('La unidad REGA indicada no existe o no pertenece a esta cuenta', 404);
  }

  return unidadRega;
}

async function checkReproductiveStatus(estadoReproductivoSugeridoId, cuentaGanaderaId) {
  if (!estadoReproductivoSugeridoId) {
    return null;
  }

  const estado = await prisma.catalogoEstadoReproductivo.findFirst({
    where: {
      id: Number(estadoReproductivoSugeridoId),
      cuentaGanaderaId
    }
  });

  if (!estado) {
    throw new AppError('El estado reproductivo sugerido no existe', 404);
  }

  return estado;
}

async function listPens(cuentaGanaderaId) {
  return prisma.corral.findMany({
    where: {
      activo: true,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: getPenInclude(),
    orderBy: {
      nombre: 'asc'
    }
  });
}

async function getPenById(id, cuentaGanaderaId) {
  const pen = await prisma.corral.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: {
      unidadRega: true,
      estadoReproductivoSugerido: true,
      animalesActuales: {
        include: {
          especie: true,
          raza: true,
          estadoReproductivo: true
        },
        orderBy: {
          crotal: 'asc'
        }
      }
    }
  });

  if (!pen) {
    throw new AppError('Corral no encontrado', 404);
  }

  return pen;
}

function normalizePenName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function comparablePenName(name) {
  return normalizePenName(name).toLocaleLowerCase('es-ES');
}

async function findDuplicatedPen({ name, unidadRegaId, excludeId = null }) {
  const normalized = normalizePenName(name);
  const pens = await prisma.corral.findMany({
    where: {
      unidadRegaId: Number(unidadRegaId),
      ...(excludeId ? { NOT: { id: Number(excludeId) } } : {})
    },
    select: {
      id: true,
      nombre: true
    }
  });

  return pens.find((pen) => comparablePenName(pen.nombre) === comparablePenName(normalized)) || null;
}

async function suggestPenName(baseName, unidadRegaId, excludeId = null) {
  const normalized = normalizePenName(baseName);
  const pens = await prisma.corral.findMany({
    where: {
      unidadRegaId: Number(unidadRegaId),
      ...(excludeId ? { NOT: { id: Number(excludeId) } } : {})
    },
    select: {
      nombre: true
    }
  });
  const existing = new Set(pens.map((pen) => comparablePenName(pen.nombre)));

  let suffix = 2;
  let candidate = `${normalized} ${suffix}`;
  while (existing.has(comparablePenName(candidate))) {
    suffix++;
    candidate = `${normalized} ${suffix}`;
  }

  return candidate;
}

async function checkRetireDestinationPen(currentPen, moveAnimalsToPenId, cuentaGanaderaId) {
  if (!moveAnimalsToPenId) {
    return null;
  }

  if (Number(moveAnimalsToPenId) === currentPen.id) {
    throw new AppError('El corral destino debe ser distinto al corral eliminado', 400);
  }

  const destinationPen = await prisma.corral.findFirst({
    where: {
      id: Number(moveAnimalsToPenId),
      activo: true,
      unidadRega: {
        cuentaGanaderaId
      }
    }
  });

  if (!destinationPen) {
    throw new AppError('El corral destino no existe o no pertenece a esta cuenta', 404);
  }

  if (destinationPen.unidadRegaId !== currentPen.unidadRegaId) {
    throw new AppError('El traslado por eliminación debe hacerse dentro de la misma unidad REGA', 400);
  }

  return destinationPen;
}

async function createPen(data, cuentaGanaderaId) {
  const {
    nombre,
    tipoFuncional,
    capacidad,
    aplicarEstadoAutomaticamente,
    unidadRegaId,
    estadoReproductivoSugeridoId
  } = data;

  const normalizedName = normalizePenName(nombre);

  if (!normalizedName || !unidadRegaId) {
    throw new AppError('El nombre y la unidad REGA son obligatorios', 400);
  }

  await checkFarmUnit(unidadRegaId, cuentaGanaderaId);
  await checkReproductiveStatus(estadoReproductivoSugeridoId, cuentaGanaderaId);

  const duplicatedPen = await findDuplicatedPen({
    name: normalizedName,
    unidadRegaId
  });

  if (duplicatedPen) {
    const suggestion = await suggestPenName(duplicatedPen.nombre, unidadRegaId);
    throw new AppError('Ya existe un corral con ese nombre en esa unidad REGA', 409, {
      suggestedName: suggestion
    });
  }

  return prisma.corral.create({
    data: {
      nombre: normalizedName,
      tipoFuncional: tipoFuncional || null,
      capacidad: capacidad ? Number(capacidad) : null,
      aplicarEstadoAutomaticamente: aplicarEstadoAutomaticamente || false,
      unidadRegaId: Number(unidadRegaId),
      estadoReproductivoSugeridoId: estadoReproductivoSugeridoId
        ? Number(estadoReproductivoSugeridoId)
        : null
    },
    include: getPenInclude()
  });
}

async function updatePen(id, data, cuentaGanaderaId) {
  const currentPen = await getPenById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.nombre !== undefined) {
    updateData.nombre = normalizePenName(data.nombre);
    if (!updateData.nombre) {
      throw new AppError('El nombre del corral es obligatorio', 400);
    }
  }

  if (data.tipoFuncional !== undefined) {
    updateData.tipoFuncional = data.tipoFuncional || null;
  }

  if (data.capacidad !== undefined) {
    updateData.capacidad = data.capacidad ? Number(data.capacidad) : null;
  }

  if (data.aplicarEstadoAutomaticamente !== undefined) {
    updateData.aplicarEstadoAutomaticamente = data.aplicarEstadoAutomaticamente;
  }

  if (data.unidadRegaId !== undefined) {
    await checkFarmUnit(data.unidadRegaId, cuentaGanaderaId);
    updateData.unidadRegaId = Number(data.unidadRegaId);
  }

  if (data.estadoReproductivoSugeridoId !== undefined) {
    await checkReproductiveStatus(data.estadoReproductivoSugeridoId, cuentaGanaderaId);

    updateData.estadoReproductivoSugeridoId = data.estadoReproductivoSugeridoId
      ? Number(data.estadoReproductivoSugeridoId)
      : null;
  }

  if (updateData.nombre) {
    const duplicatedPen = await findDuplicatedPen({
      name: updateData.nombre,
      unidadRegaId: updateData.unidadRegaId || currentPen.unidadRegaId,
      excludeId: id
    });

    if (duplicatedPen) {
      const suggestion = await suggestPenName(
        duplicatedPen.nombre,
        updateData.unidadRegaId || currentPen.unidadRegaId,
        id
      );
      throw new AppError('Ya existe otro corral con ese nombre en esa unidad REGA', 409, {
        suggestedName: suggestion
      });
    }
  }

  return prisma.corral.update({
    where: {
      id
    },
    data: updateData,
    include: getPenInclude()
  });
}

async function retirePen(id, data, user) {
  const currentPen = await prisma.corral.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId: user.cuentaGanaderaId
      }
    },
    include: {
      unidadRega: true,
      animalesActuales: {
        select: {
          id: true,
          crotal: true,
          corralActualId: true
        },
        orderBy: {
          crotal: 'asc'
        }
      }
    }
  });

  if (!currentPen) {
    throw new AppError('Corral no encontrado', 404);
  }

  if (currentPen.activo === false) {
    return currentPen;
  }

  const animals = currentPen.animalesActuales || [];
  const destinationPen = await checkRetireDestinationPen(
    currentPen,
    data?.moveAnimalsToPenId,
    user.cuentaGanaderaId
  );

  if (animals.length > 0 && !destinationPen) {
    throw new AppError('Este corral tiene animales. Elige un corral destino o cancela la eliminación.', 400);
  }

  const retireDate = data?.fecha ? new Date(data.fecha) : new Date();

  return prisma.$transaction(async (tx) => {
    let movement = null;

    if (animals.length > 0 && destinationPen) {
      movement = await tx.movimientoTransaccion.create({
        data: {
          tipoOperacion: 'CORRAL_COMPLETO',
          motivo: 'Corral eliminado',
          fecha: retireDate,
          unidadRegaId: currentPen.unidadRegaId,
          corralOrigenId: currentPen.id,
          corralDestinoId: destinationPen.id,
          userId: user.id,
          resumen: {
            procesados: animals.length,
            motivo: 'Corral eliminado',
            corralOrigenId: currentPen.id,
            corralDestinoId: destinationPen.id
          }
        }
      });

      for (const animal of animals) {
        await tx.animal.update({
          where: {
            id: animal.id
          },
          data: {
            corralActualId: destinationPen.id,
            fechaEntradaCorralActual: retireDate
          }
        });

        await tx.movimientoAnimalDetalle.create({
          data: {
            transaccionId: movement.id,
            crotalLeido: animal.crotal,
            estadoProceso: 'PROCESADO',
            animalId: animal.id,
            corralOrigenId: currentPen.id,
            corralDestinoId: destinationPen.id,
            observaciones: 'Traslado por eliminación de corral'
          }
        });
      }
    }

    const retiredPen = await tx.corral.update({
      where: {
        id: currentPen.id
      },
      data: {
        activo: false
      },
      include: getPenInclude()
    });

    return {
      ...retiredPen,
      movedAnimals: animals.length,
      movementId: movement?.id || null
    };
  });
}

module.exports = {
  listPens,
  getPenById,
  createPen,
  updatePen,
  retirePen
};
