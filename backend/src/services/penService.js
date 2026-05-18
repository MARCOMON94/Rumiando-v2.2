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

async function createPen(data, cuentaGanaderaId) {
  const {
    nombre,
    tipoFuncional,
    capacidad,
    aplicarEstadoAutomaticamente,
    unidadRegaId,
    estadoReproductivoSugeridoId
  } = data;

  if (!nombre || !unidadRegaId) {
    throw new AppError('El nombre y la unidad REGA son obligatorios', 400);
  }

  await checkFarmUnit(unidadRegaId, cuentaGanaderaId);
  await checkReproductiveStatus(estadoReproductivoSugeridoId, cuentaGanaderaId);

  const duplicatedPen = await prisma.corral.findFirst({
    where: {
      nombre: nombre.trim(),
      unidadRegaId: Number(unidadRegaId)
    }
  });

  if (duplicatedPen) {
    throw new AppError('Ya existe un corral con ese nombre en esa unidad REGA', 409);
  }

  return prisma.corral.create({
    data: {
      nombre: nombre.trim(),
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
    updateData.nombre = data.nombre.trim();
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
    const duplicatedPen = await prisma.corral.findFirst({
      where: {
        nombre: updateData.nombre,
        unidadRegaId: updateData.unidadRegaId || currentPen.unidadRegaId,
        NOT: {
          id
        }
      }
    });

    if (duplicatedPen) {
      throw new AppError('Ya existe otro corral con ese nombre en esa unidad REGA', 409);
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

module.exports = {
  listPens,
  getPenById,
  createPen,
  updatePen
};