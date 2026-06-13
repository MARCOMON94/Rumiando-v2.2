const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getDewormingInclude() {
  return {
    unidadRega: true,
    animal: {
      include: {
        especie: true,
        raza: true,
        corralActual: true
      }
    },
    corral: true
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

async function checkAnimal(animalId, cuentaGanaderaId) {
  if (!animalId) {
    return null;
  }

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

  if (animal.estadoRegistro === 'BAJA') {
    throw new AppError('No se pueden añadir desparasitaciones a un animal dado de baja', 400);
  }

  return animal;
}

async function checkPen(corralId, cuentaGanaderaId) {
  if (!corralId) {
    return null;
  }

  const pen = await prisma.corral.findFirst({
    where: {
      id: Number(corralId),
      unidadRega: {
        cuentaGanaderaId
      }
    }
  });

  if (!pen) {
    throw new AppError('Corral no encontrado para esta cuenta ganadera', 404);
  }

  return pen;
}

async function listDewormings(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: {
      cuentaGanaderaId
    }
  };

  if (filters.unidadRegaId) {
    where.unidadRegaId = Number(filters.unidadRegaId);
  }

  if (filters.animalId) {
    where.animalId = Number(filters.animalId);
  }

  if (filters.corralId) {
    where.corralId = Number(filters.corralId);
  }

  if (filters.tipo) {
    where.tipo = filters.tipo;
  }

  if (filters.proximaDosisPrevista !== undefined) {
    where.proximaDosisPrevista = filters.proximaDosisPrevista === 'true';
  }

  if (filters.reaccion !== undefined) {
    where.reaccion = filters.reaccion === 'true';
  }

  return prisma.desparasitacion.findMany({
    where,
    include: getDewormingInclude(),
    orderBy: {
      fecha: 'desc'
    }
  });
}

async function getDewormingById(id, cuentaGanaderaId) {
  const deworming = await prisma.desparasitacion.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: getDewormingInclude()
  });

  if (!deworming) {
    throw new AppError('Desparasitación no encontrada', 404);
  }

  return deworming;
}

async function createDeworming(data, cuentaGanaderaId) {
  const {
    fecha,
    tipo,
    producto,
    principioActivo,
    dosisTexto,
    via,
    motivo,
    proximaDosisPrevista,
    fechaProximaDosis,
    reaccion,
    documentoUrl,
    unidadRegaId,
    animalId,
    corralId
  } = data;

  if (!fecha || !tipo || !producto || !unidadRegaId) {
    throw new AppError('fecha, tipo, producto y unidadRegaId son obligatorios', 400);
  }

  await checkFarmUnit(unidadRegaId, cuentaGanaderaId);
  await checkAnimal(animalId, cuentaGanaderaId);
  await checkPen(corralId, cuentaGanaderaId);

  if (!animalId && !corralId) {
    throw new AppError('Debe asociarse la desparasitación a un animal o corral', 400);
  }

  return prisma.desparasitacion.create({
    data: {
      fecha: new Date(fecha),
      tipo,
      producto,
      principioActivo: principioActivo || null,
      dosisTexto: dosisTexto || null,
      via: via || null,
      motivo: motivo || null,
      proximaDosisPrevista: proximaDosisPrevista || false,
      fechaProximaDosis: fechaProximaDosis ? new Date(fechaProximaDosis) : null,
      reaccion: reaccion || false,
      documentoUrl: documentoUrl || null,
      unidadRegaId: Number(unidadRegaId),
      animalId: animalId ? Number(animalId) : null,
      corralId: corralId ? Number(corralId) : null
    },
    include: getDewormingInclude()
  });
}

async function updateDeworming(id, data, cuentaGanaderaId) {
  await getDewormingById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.fecha !== undefined) {
    updateData.fecha = data.fecha ? new Date(data.fecha) : null;
  }

  if (data.tipo !== undefined) {
    updateData.tipo = data.tipo;
  }

  if (data.producto !== undefined) {
    updateData.producto = data.producto;
  }

  if (data.principioActivo !== undefined) {
    updateData.principioActivo = data.principioActivo || null;
  }

  if (data.dosisTexto !== undefined) {
    updateData.dosisTexto = data.dosisTexto || null;
  }

  if (data.via !== undefined) {
    updateData.via = data.via || null;
  }

  if (data.motivo !== undefined) {
    updateData.motivo = data.motivo || null;
  }

  if (data.proximaDosisPrevista !== undefined) {
    updateData.proximaDosisPrevista = data.proximaDosisPrevista;
  }

  if (data.fechaProximaDosis !== undefined) {
    updateData.fechaProximaDosis = data.fechaProximaDosis
      ? new Date(data.fechaProximaDosis)
      : null;
  }

  if (data.reaccion !== undefined) {
    updateData.reaccion = data.reaccion;
  }

  if (data.documentoUrl !== undefined) {
    updateData.documentoUrl = data.documentoUrl || null;
  }

  if (data.unidadRegaId !== undefined) {
    await checkFarmUnit(data.unidadRegaId, cuentaGanaderaId);
    updateData.unidadRegaId = Number(data.unidadRegaId);
  }

  if (data.animalId !== undefined) {
    await checkAnimal(data.animalId, cuentaGanaderaId);
    updateData.animalId = data.animalId ? Number(data.animalId) : null;
  }

  if (data.corralId !== undefined) {
    await checkPen(data.corralId, cuentaGanaderaId);
    updateData.corralId = data.corralId ? Number(data.corralId) : null;
  }

  return prisma.desparasitacion.update({
    where: {
      id
    },
    data: updateData,
    include: getDewormingInclude()
  });
}

module.exports = {
  listDewormings,
  getDewormingById,
  createDeworming,
  updateDeworming
};
