const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

async function listFarmUnits(cuentaGanaderaId) {
  return prisma.unidadRega.findMany({
    where: {
      cuentaGanaderaId
    },
    orderBy: {
      nombre: 'asc'
    }
  });
}

async function getFarmUnitById(id, cuentaGanaderaId) {
  const farmUnit = await prisma.unidadRega.findFirst({
    where: {
      id,
      cuentaGanaderaId
    }
  });

  if (!farmUnit) {
    throw new AppError('Unidad REGA no encontrada', 404);
  }

  return farmUnit;
}

async function createFarmUnit(data, cuentaGanaderaId) {
  const {
    nombre,
    codigoRega,
    direccion,
    municipio,
    provincia,
    activa
  } = data;

  if (!nombre) {
    throw new AppError('El nombre de la unidad REGA es obligatorio', 400);
  }

  if (codigoRega) {
    const duplicatedFarmUnit = await prisma.unidadRega.findFirst({
      where: {
        codigoRega: codigoRega.trim(),
        cuentaGanaderaId
      }
    });

    if (duplicatedFarmUnit) {
      throw new AppError('Ya existe una unidad REGA con ese código', 409);
    }
  }

  return prisma.unidadRega.create({
    data: {
      nombre: nombre.trim(),
      codigoRega: codigoRega ? codigoRega.trim() : null,
      direccion: direccion || null,
      municipio: municipio || null,
      provincia: provincia || null,
      activa: activa !== undefined ? activa : true,
      cuentaGanaderaId
    }
  });
}

async function updateFarmUnit(id, data, cuentaGanaderaId) {
  await getFarmUnitById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.nombre !== undefined) {
    updateData.nombre = data.nombre.trim();
  }

  if (data.codigoRega !== undefined) {
    updateData.codigoRega = data.codigoRega ? data.codigoRega.trim() : null;
  }

  if (data.direccion !== undefined) {
    updateData.direccion = data.direccion || null;
  }

  if (data.municipio !== undefined) {
    updateData.municipio = data.municipio || null;
  }

  if (data.provincia !== undefined) {
    updateData.provincia = data.provincia || null;
  }

  if (data.activa !== undefined) {
    updateData.activa = data.activa;
  }

  if (updateData.codigoRega) {
    const duplicatedFarmUnit = await prisma.unidadRega.findFirst({
      where: {
        codigoRega: updateData.codigoRega,
        cuentaGanaderaId,
        NOT: {
          id
        }
      }
    });

    if (duplicatedFarmUnit) {
      throw new AppError('Ya existe otra unidad REGA con ese código', 409);
    }
  }

  return prisma.unidadRega.update({
    where: {
      id
    },
    data: updateData
  });
}

module.exports = {
  listFarmUnits,
  getFarmUnitById,
  createFarmUnit,
  updateFarmUnit
};