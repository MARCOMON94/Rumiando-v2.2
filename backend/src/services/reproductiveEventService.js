const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getReproductiveEventInclude() {
  return {
    animal: {
      include: {
        unidadRega: true,
        especie: true,
        raza: true,
        corralActual: true,
        estadoReproductivo: true
      }
    },
    estadoResultante: true
  };
}

async function checkAnimal(animalId, cuentaGanaderaId) {
  const animal = await prisma.animal.findFirst({
    where: {
      id: Number(animalId),
      unidadRega: {
        cuentaGanaderaId
      }
    }
  });

  if (!animal) {
    throw new AppError('Animal no encontrado para esta cuenta ganadera', 404);
  }

  return animal;
}

async function checkReproductiveStatus(estadoResultanteId, cuentaGanaderaId) {
  if (!estadoResultanteId) {
    return null;
  }

  const reproductiveStatus = await prisma.catalogoEstadoReproductivo.findFirst({
    where: {
      id: Number(estadoResultanteId),
      cuentaGanaderaId
    }
  });

  if (!reproductiveStatus) {
    throw new AppError('Estado reproductivo resultante no encontrado para esta cuenta ganadera', 404);
  }

  return reproductiveStatus;
}

async function listReproductiveEvents(cuentaGanaderaId, filters = {}) {
  const where = {
    animal: {
      unidadRega: {
        cuentaGanaderaId
      }
    }
  };

  if (filters.animalId) {
    where.animalId = Number(filters.animalId);
  }

  if (filters.tipoEvento) {
    where.tipoEvento = filters.tipoEvento;
  }

  if (filters.resultado) {
    where.resultado = filters.resultado;
  }

  if (filters.estadoResultanteId) {
    where.estadoResultanteId = Number(filters.estadoResultanteId);
  }

  return prisma.eventoReproductivo.findMany({
    where,
    include: getReproductiveEventInclude(),
    orderBy: {
      fecha: 'desc'
    }
  });
}

async function getReproductiveEventById(id, cuentaGanaderaId) {
  const reproductiveEvent = await prisma.eventoReproductivo.findFirst({
    where: {
      id,
      animal: {
        unidadRega: {
          cuentaGanaderaId
        }
      }
    },
    include: getReproductiveEventInclude()
  });

  if (!reproductiveEvent) {
    throw new AppError('Evento reproductivo no encontrado', 404);
  }

  return reproductiveEvent;
}

async function createReproductiveEvent(data, cuentaGanaderaId) {
  const {
    tipoEvento,
    resultado,
    fecha,
    semanasGestacion,
    fechaPartoEstimada,
    numeroCriasVivas,
    numeroCriasMuertas,
    observaciones,
    animalId,
    estadoResultanteId
  } = data;

  if (!tipoEvento || !fecha || !animalId) {
    throw new AppError('tipoEvento, fecha y animalId son obligatorios', 400);
  }

  await checkAnimal(animalId, cuentaGanaderaId);
  await checkReproductiveStatus(estadoResultanteId, cuentaGanaderaId);

  return prisma.$transaction(async (tx) => {
    const reproductiveEvent = await tx.eventoReproductivo.create({
      data: {
        tipoEvento,
        resultado: resultado || 'NO_APLICA',
        fecha: new Date(fecha),
        semanasGestacion: semanasGestacion ? Number(semanasGestacion) : null,
        fechaPartoEstimada: fechaPartoEstimada ? new Date(fechaPartoEstimada) : null,
        numeroCriasVivas: numeroCriasVivas ? Number(numeroCriasVivas) : null,
        numeroCriasMuertas: numeroCriasMuertas ? Number(numeroCriasMuertas) : null,
        observaciones: observaciones || null,
        animalId: Number(animalId),
        estadoResultanteId: estadoResultanteId ? Number(estadoResultanteId) : null
      },
      include: getReproductiveEventInclude()
    });

    if (estadoResultanteId) {
      await tx.animal.update({
        where: {
          id: Number(animalId)
        },
        data: {
          estadoReproductivoId: Number(estadoResultanteId)
        }
      });
    }

    return reproductiveEvent;
  });
}

async function updateReproductiveEvent(id, data, cuentaGanaderaId) {
  await getReproductiveEventById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.tipoEvento !== undefined) {
    updateData.tipoEvento = data.tipoEvento;
  }

  if (data.resultado !== undefined) {
    updateData.resultado = data.resultado;
  }

  if (data.fecha !== undefined) {
    updateData.fecha = data.fecha ? new Date(data.fecha) : null;
  }

  if (data.semanasGestacion !== undefined) {
    updateData.semanasGestacion = data.semanasGestacion
      ? Number(data.semanasGestacion)
      : null;
  }

  if (data.fechaPartoEstimada !== undefined) {
    updateData.fechaPartoEstimada = data.fechaPartoEstimada
      ? new Date(data.fechaPartoEstimada)
      : null;
  }

  if (data.numeroCriasVivas !== undefined) {
    updateData.numeroCriasVivas = data.numeroCriasVivas
      ? Number(data.numeroCriasVivas)
      : null;
  }

  if (data.numeroCriasMuertas !== undefined) {
    updateData.numeroCriasMuertas = data.numeroCriasMuertas
      ? Number(data.numeroCriasMuertas)
      : null;
  }

  if (data.observaciones !== undefined) {
    updateData.observaciones = data.observaciones || null;
  }

  if (data.animalId !== undefined) {
    await checkAnimal(data.animalId, cuentaGanaderaId);
    updateData.animalId = Number(data.animalId);
  }

  if (data.estadoResultanteId !== undefined) {
    await checkReproductiveStatus(data.estadoResultanteId, cuentaGanaderaId);
    updateData.estadoResultanteId = data.estadoResultanteId
      ? Number(data.estadoResultanteId)
      : null;
  }

  return prisma.$transaction(async (tx) => {
    const reproductiveEvent = await tx.eventoReproductivo.update({
      where: {
        id
      },
      data: updateData,
      include: getReproductiveEventInclude()
    });

    if (data.estadoResultanteId !== undefined) {
      await tx.animal.update({
        where: {
          id: reproductiveEvent.animalId
        },
        data: {
          estadoReproductivoId: data.estadoResultanteId
            ? Number(data.estadoResultanteId)
            : null
        }
      });
    }

    return reproductiveEvent;
  });
}

module.exports = {
  listReproductiveEvents,
  getReproductiveEventById,
  createReproductiveEvent,
  updateReproductiveEvent
};