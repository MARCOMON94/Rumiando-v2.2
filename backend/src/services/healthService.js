const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getHealthCaseInclude() {
  return {
    unidadRega: true,
    animal: {
      include: {
        especie: true,
        raza: true,
        corralActual: true
      }
    },
    corral: true,
    enfermedad: true,
    tratamientos: true
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
    throw new AppError('No se pueden añadir eventos sanitarios a un animal dado de baja', 400);
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

async function checkDisease(enfermedadId, cuentaGanaderaId) {
  if (!enfermedadId) {
    return null;
  }

  const disease = await prisma.catalogoEnfermedad.findFirst({
    where: {
      id: Number(enfermedadId),
      cuentaGanaderaId
    }
  });

  if (!disease) {
    throw new AppError('Enfermedad no encontrada para esta cuenta ganadera', 404);
  }

  return disease;
}

async function listHealthCases(cuentaGanaderaId, filters = {}) {
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

  if (filters.enfermedadId) {
    where.enfermedadId = Number(filters.enfermedadId);
  }

  if (filters.estado) {
    where.estado = filters.estado;
  }

  return prisma.casoSanitario.findMany({
    where,
    include: getHealthCaseInclude(),
    orderBy: {
      fechaInicio: 'desc'
    }
  });
}

async function getHealthCaseById(id, cuentaGanaderaId) {
  const healthCase = await prisma.casoSanitario.findFirst({
    where: {
      id,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: getHealthCaseInclude()
  });

  if (!healthCase) {
    throw new AppError('Caso sanitario no encontrado', 404);
  }

  return healthCase;
}

async function createHealthCase(data, cuentaGanaderaId) {
  const {
    fechaInicio,
    signosClinicos,
    diagnosticoPresuntivo,
    diagnosticoConfirmado,
    gravedad,
    afectaBienestar,
    lazareto,
    avisoDeclaracionMostrado,
    estado,
    fechaCierre,
    resultado,
    unidadRegaId,
    animalId,
    corralId,
    enfermedadId
  } = data;

  if (!fechaInicio || !unidadRegaId) {
    throw new AppError('fechaInicio y unidadRegaId son obligatorios', 400);
  }

  await checkFarmUnit(unidadRegaId, cuentaGanaderaId);
  await checkAnimal(animalId, cuentaGanaderaId);
  await checkPen(corralId, cuentaGanaderaId);
  await checkDisease(enfermedadId, cuentaGanaderaId);

  return prisma.casoSanitario.create({
    data: {
      fechaInicio: new Date(fechaInicio),
      signosClinicos: signosClinicos || null,
      diagnosticoPresuntivo: diagnosticoPresuntivo || null,
      diagnosticoConfirmado: diagnosticoConfirmado || null,
      gravedad: gravedad || null,
      afectaBienestar: afectaBienestar || false,
      lazareto: lazareto || false,
      avisoDeclaracionMostrado: avisoDeclaracionMostrado || false,
      estado: estado || 'ABIERTO',
      fechaCierre: fechaCierre ? new Date(fechaCierre) : null,
      resultado: resultado || null,
      unidadRegaId: Number(unidadRegaId),
      animalId: animalId ? Number(animalId) : null,
      corralId: corralId ? Number(corralId) : null,
      enfermedadId: enfermedadId ? Number(enfermedadId) : null
    },
    include: getHealthCaseInclude()
  });
}

async function updateHealthCase(id, data, cuentaGanaderaId) {
  await getHealthCaseById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.fechaInicio !== undefined) {
    updateData.fechaInicio = data.fechaInicio ? new Date(data.fechaInicio) : null;
  }

  if (data.signosClinicos !== undefined) {
    updateData.signosClinicos = data.signosClinicos || null;
  }

  if (data.diagnosticoPresuntivo !== undefined) {
    updateData.diagnosticoPresuntivo = data.diagnosticoPresuntivo || null;
  }

  if (data.diagnosticoConfirmado !== undefined) {
    updateData.diagnosticoConfirmado = data.diagnosticoConfirmado || null;
  }

  if (data.gravedad !== undefined) {
    updateData.gravedad = data.gravedad || null;
  }

  if (data.afectaBienestar !== undefined) {
    updateData.afectaBienestar = data.afectaBienestar;
  }

  if (data.lazareto !== undefined) {
    updateData.lazareto = data.lazareto;
  }

  if (data.avisoDeclaracionMostrado !== undefined) {
    updateData.avisoDeclaracionMostrado = data.avisoDeclaracionMostrado;
  }

  if (data.estado !== undefined) {
    updateData.estado = data.estado;
  }

  if (data.fechaCierre !== undefined) {
    updateData.fechaCierre = data.fechaCierre ? new Date(data.fechaCierre) : null;
  }

  if (data.resultado !== undefined) {
    updateData.resultado = data.resultado || null;
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

  if (data.enfermedadId !== undefined) {
    await checkDisease(data.enfermedadId, cuentaGanaderaId);
    updateData.enfermedadId = data.enfermedadId ? Number(data.enfermedadId) : null;
  }

  return prisma.casoSanitario.update({
    where: {
      id
    },
    data: updateData,
    include: getHealthCaseInclude()
  });
}

module.exports = {
  listHealthCases,
  getHealthCaseById,
  createHealthCase,
  updateHealthCase
};
