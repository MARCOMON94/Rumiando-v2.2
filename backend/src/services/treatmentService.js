const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getTreatmentInclude() {
  return {
    casoSanitario: {
      include: {
        unidadRega: true,
        enfermedad: true
      }
    },
    animal: {
      include: {
        especie: true,
        raza: true,
        corralActual: true,
        unidadRega: true
      }
    },
    corral: {
      include: {
        unidadRega: true
      }
    }
  };
}

async function checkHealthCase(casoSanitarioId, cuentaGanaderaId) {
  if (!casoSanitarioId) {
    return null;
  }

  const healthCase = await prisma.casoSanitario.findFirst({
    where: {
      id: Number(casoSanitarioId),
      unidadRega: {
        cuentaGanaderaId
      }
    }
  });

  if (!healthCase) {
    throw new AppError('Caso sanitario no encontrado para esta cuenta ganadera', 404);
  }

  return healthCase;
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

async function listTreatments(cuentaGanaderaId, filters = {}) {
  const where = {
    OR: [
      {
        animal: {
          unidadRega: {
            cuentaGanaderaId
          }
        }
      },
      {
        corral: {
          unidadRega: {
            cuentaGanaderaId
          }
        }
      },
      {
        casoSanitario: {
          unidadRega: {
            cuentaGanaderaId
          }
        }
      }
    ]
  };

  if (filters.animalId) {
    where.animalId = Number(filters.animalId);
  }

  if (filters.corralId) {
    where.corralId = Number(filters.corralId);
  }

  if (filters.casoSanitarioId) {
    where.casoSanitarioId = Number(filters.casoSanitarioId);
  }

  return prisma.tratamientoVeterinario.findMany({
    where,
    include: getTreatmentInclude(),
    orderBy: {
      fechaInicio: 'desc'
    }
  });
}

async function getTreatmentById(id, cuentaGanaderaId) {
  const treatment = await prisma.tratamientoVeterinario.findFirst({
    where: {
      id,
      OR: [
        {
          animal: {
            unidadRega: {
              cuentaGanaderaId
            }
          }
        },
        {
          corral: {
            unidadRega: {
              cuentaGanaderaId
            }
          }
        },
        {
          casoSanitario: {
            unidadRega: {
              cuentaGanaderaId
            }
          }
        }
      ]
    },
    include: getTreatmentInclude()
  });

  if (!treatment) {
    throw new AppError('Tratamiento no encontrado', 404);
  }

  return treatment;
}

async function createTreatment(data, cuentaGanaderaId) {
  const {
    fechaInicio,
    fechaFin,
    motivo,
    medicamentoProducto,
    principioActivo,
    dosisTexto,
    unidad,
    via,
    frecuencia,
    duracionDias,
    retirada,
    documentoUrl,
    casoSanitarioId,
    animalId,
    corralId
  } = data;

  if (!fechaInicio || !medicamentoProducto) {
    throw new AppError('fechaInicio y medicamentoProducto son obligatorios', 400);
  }

  await checkHealthCase(casoSanitarioId, cuentaGanaderaId);
  await checkAnimal(animalId, cuentaGanaderaId);
  await checkPen(corralId, cuentaGanaderaId);

  if (!casoSanitarioId && !animalId && !corralId) {
    throw new AppError('Debe asociarse el tratamiento a un caso sanitario, animal o corral', 400);
  }

  return prisma.tratamientoVeterinario.create({
    data: {
      fechaInicio: new Date(fechaInicio),
      fechaFin: fechaFin ? new Date(fechaFin) : null,
      motivo: motivo || null,
      medicamentoProducto,
      principioActivo: principioActivo || null,
      dosisTexto: dosisTexto || null,
      unidad: unidad || null,
      via: via || null,
      frecuencia: frecuencia || null,
      duracionDias: duracionDias ? Number(duracionDias) : null,
      retirada: retirada || null,
      documentoUrl: documentoUrl || null,
      casoSanitarioId: casoSanitarioId ? Number(casoSanitarioId) : null,
      animalId: animalId ? Number(animalId) : null,
      corralId: corralId ? Number(corralId) : null
    },
    include: getTreatmentInclude()
  });
}

async function updateTreatment(id, data, cuentaGanaderaId) {
  await getTreatmentById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.fechaInicio !== undefined) {
    updateData.fechaInicio = data.fechaInicio ? new Date(data.fechaInicio) : null;
  }

  if (data.fechaFin !== undefined) {
    updateData.fechaFin = data.fechaFin ? new Date(data.fechaFin) : null;
  }

  if (data.motivo !== undefined) {
    updateData.motivo = data.motivo || null;
  }

  if (data.medicamentoProducto !== undefined) {
    updateData.medicamentoProducto = data.medicamentoProducto;
  }

  if (data.principioActivo !== undefined) {
    updateData.principioActivo = data.principioActivo || null;
  }

  if (data.dosisTexto !== undefined) {
    updateData.dosisTexto = data.dosisTexto || null;
  }

  if (data.unidad !== undefined) {
    updateData.unidad = data.unidad || null;
  }

  if (data.via !== undefined) {
    updateData.via = data.via || null;
  }

  if (data.frecuencia !== undefined) {
    updateData.frecuencia = data.frecuencia || null;
  }

  if (data.duracionDias !== undefined) {
    updateData.duracionDias = data.duracionDias ? Number(data.duracionDias) : null;
  }

  if (data.retirada !== undefined) {
    updateData.retirada = data.retirada || null;
  }

  if (data.documentoUrl !== undefined) {
    updateData.documentoUrl = data.documentoUrl || null;
  }

  if (data.casoSanitarioId !== undefined) {
    await checkHealthCase(data.casoSanitarioId, cuentaGanaderaId);
    updateData.casoSanitarioId = data.casoSanitarioId ? Number(data.casoSanitarioId) : null;
  }

  if (data.animalId !== undefined) {
    await checkAnimal(data.animalId, cuentaGanaderaId);
    updateData.animalId = data.animalId ? Number(data.animalId) : null;
  }

  if (data.corralId !== undefined) {
    await checkPen(data.corralId, cuentaGanaderaId);
    updateData.corralId = data.corralId ? Number(data.corralId) : null;
  }

  return prisma.tratamientoVeterinario.update({
    where: {
      id
    },
    data: updateData,
    include: getTreatmentInclude()
  });
}

module.exports = {
  listTreatments,
  getTreatmentById,
  createTreatment,
  updateTreatment
};