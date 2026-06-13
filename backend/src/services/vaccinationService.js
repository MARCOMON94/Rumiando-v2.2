const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getVaccinationInclude() {
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
    throw new AppError('No se pueden añadir vacunaciones a un animal dado de baja', 400);
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

async function listVaccinations(cuentaGanaderaId, filters = {}) {
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

  if (filters.revacunacionPrevista !== undefined) {
    where.revacunacionPrevista = filters.revacunacionPrevista === 'true';
  }

  if (filters.reaccion !== undefined) {
    where.reaccion = filters.reaccion === 'true';
  }

  return prisma.vacunacion.findMany({
    where,
    include: getVaccinationInclude(),
    orderBy: {
      fecha: 'desc'
    }
  });
}

async function getVaccinationById(id, cuentaGanaderaId) {
  const vaccination = await prisma.vacunacion.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: getVaccinationInclude()
  });

  if (!vaccination) {
    throw new AppError('Vacunación no encontrada', 404);
  }

  return vaccination;
}

async function createVaccination(data, cuentaGanaderaId) {
  const {
    fecha,
    vacuna,
    loteVacuna,
    dosisTexto,
    via,
    revacunacionPrevista,
    fechaRevacunacion,
    reaccion,
    documentoUrl,
    unidadRegaId,
    animalId,
    corralId
  } = data;

  if (!fecha || !vacuna || !unidadRegaId) {
    throw new AppError('fecha, vacuna y unidadRegaId son obligatorios', 400);
  }

  await checkFarmUnit(unidadRegaId, cuentaGanaderaId);
  await checkAnimal(animalId, cuentaGanaderaId);
  await checkPen(corralId, cuentaGanaderaId);

  if (!animalId && !corralId) {
    throw new AppError('Debe asociarse la vacunación a un animal o corral', 400);
  }

  return prisma.vacunacion.create({
    data: {
      fecha: new Date(fecha),
      vacuna,
      loteVacuna: loteVacuna || null,
      dosisTexto: dosisTexto || null,
      via: via || null,
      revacunacionPrevista: revacunacionPrevista || false,
      fechaRevacunacion: fechaRevacunacion ? new Date(fechaRevacunacion) : null,
      reaccion: reaccion || false,
      documentoUrl: documentoUrl || null,
      unidadRegaId: Number(unidadRegaId),
      animalId: animalId ? Number(animalId) : null,
      corralId: corralId ? Number(corralId) : null
    },
    include: getVaccinationInclude()
  });
}

async function updateVaccination(id, data, cuentaGanaderaId) {
  await getVaccinationById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.fecha !== undefined) {
    updateData.fecha = data.fecha ? new Date(data.fecha) : null;
  }

  if (data.vacuna !== undefined) {
    updateData.vacuna = data.vacuna;
  }

  if (data.loteVacuna !== undefined) {
    updateData.loteVacuna = data.loteVacuna || null;
  }

  if (data.dosisTexto !== undefined) {
    updateData.dosisTexto = data.dosisTexto || null;
  }

  if (data.via !== undefined) {
    updateData.via = data.via || null;
  }

  if (data.revacunacionPrevista !== undefined) {
    updateData.revacunacionPrevista = data.revacunacionPrevista;
  }

  if (data.fechaRevacunacion !== undefined) {
    updateData.fechaRevacunacion = data.fechaRevacunacion
      ? new Date(data.fechaRevacunacion)
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

  return prisma.vacunacion.update({
    where: {
      id
    },
    data: updateData,
    include: getVaccinationInclude()
  });
}

module.exports = {
  listVaccinations,
  getVaccinationById,
  createVaccination,
  updateVaccination
};
