const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function getReminderInclude() {
  return {
    cuentaGanadera: true,
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
    throw new AppError('No se pueden crear recordatorios para un animal dado de baja', 400);
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

async function listReminders(cuentaGanaderaId, filters = {}) {
  const where = {
    cuentaGanaderaId
  };

  if (filters.estado) {
    where.estado = filters.estado;
  }

  if (filters.tipo) {
    where.tipo = filters.tipo;
  }

  if (filters.origenRegla) {
    where.origenRegla = filters.origenRegla;
  }

  if (filters.animalId) {
    where.animalId = Number(filters.animalId);
  }

  if (filters.corralId) {
    where.corralId = Number(filters.corralId);
  }

  if (filters.pending === 'true') {
    where.estado = {
      in: ['PENDIENTE', 'POSPUESTO']
    };
  }

  if (filters.overdue === 'true') {
    const now = new Date();

    where.estado = {
      in: ['PENDIENTE', 'POSPUESTO']
    };

    where.OR = [
      {
        fechaObjetivo: {
          lte: now
        }
      },
      {
        pospuestoHasta: {
          lte: now
        }
      }
    ];
  }

  return prisma.recordatorio.findMany({
    where,
    include: getReminderInclude(),
    orderBy: [
      {
        fechaObjetivo: 'asc'
      },
      {
        createdAt: 'desc'
      }
    ]
  });
}

async function getReminderById(id, cuentaGanaderaId) {
  const reminder = await prisma.recordatorio.findFirst({
    where: {
      id,
      cuentaGanaderaId
    },
    include: getReminderInclude()
  });

  if (!reminder) {
    throw new AppError('Recordatorio no encontrado', 404);
  }

  return reminder;
}

async function createReminder(data, cuentaGanaderaId) {
  const {
    tipo,
    fechaObjetivo,
    estado,
    pospuestoHasta,
    origenRegla,
    nota,
    animalId,
    corralId
  } = data;

  if (!tipo || !fechaObjetivo) {
    throw new AppError('tipo y fechaObjetivo son obligatorios', 400);
  }

  await checkAnimal(animalId, cuentaGanaderaId);
  await checkPen(corralId, cuentaGanaderaId);

  return prisma.recordatorio.create({
    data: {
      tipo,
      fechaObjetivo: new Date(fechaObjetivo),
      estado: estado || 'PENDIENTE',
      pospuestoHasta: pospuestoHasta ? new Date(pospuestoHasta) : null,
      origenRegla: origenRegla || null,
      nota: nota || null,
      cuentaGanaderaId,
      animalId: animalId ? Number(animalId) : null,
      corralId: corralId ? Number(corralId) : null
    },
    include: getReminderInclude()
  });
}

async function updateReminder(id, data, cuentaGanaderaId) {
  await getReminderById(id, cuentaGanaderaId);

  const updateData = {};

  if (data.tipo !== undefined) {
    updateData.tipo = data.tipo;
  }

  if (data.fechaObjetivo !== undefined) {
    updateData.fechaObjetivo = data.fechaObjetivo
      ? new Date(data.fechaObjetivo)
      : null;
  }

  if (data.estado !== undefined) {
    updateData.estado = data.estado;
  }

  if (data.pospuestoHasta !== undefined) {
    updateData.pospuestoHasta = data.pospuestoHasta
      ? new Date(data.pospuestoHasta)
      : null;
  }

  if (data.origenRegla !== undefined) {
    updateData.origenRegla = data.origenRegla || null;
  }

  if (data.nota !== undefined) {
    updateData.nota = data.nota || null;
  }

  if (data.animalId !== undefined) {
    await checkAnimal(data.animalId, cuentaGanaderaId);
    updateData.animalId = data.animalId ? Number(data.animalId) : null;
  }

  if (data.corralId !== undefined) {
    await checkPen(data.corralId, cuentaGanaderaId);
    updateData.corralId = data.corralId ? Number(data.corralId) : null;
  }

  return prisma.recordatorio.update({
    where: {
      id
    },
    data: updateData,
    include: getReminderInclude()
  });
}

async function completeReminder(id, cuentaGanaderaId) {
  await getReminderById(id, cuentaGanaderaId);

  return prisma.recordatorio.update({
    where: {
      id
    },
    data: {
      estado: 'COMPLETADO',
      pospuestoHasta: null
    },
    include: getReminderInclude()
  });
}

async function snoozeReminder(id, data, cuentaGanaderaId) {
  await getReminderById(id, cuentaGanaderaId);

  const days = Number(data.days || data.dias || 0);

  if (!days || days < 1) {
    throw new AppError('Debe indicarse un número de días válido para posponer', 400);
  }

  const pospuestoHasta = new Date();
  pospuestoHasta.setDate(pospuestoHasta.getDate() + days);

  return prisma.recordatorio.update({
    where: {
      id
    },
    data: {
      estado: 'POSPUESTO',
      pospuestoHasta
    },
    include: getReminderInclude()
  });
}

module.exports = {
  listReminders,
  getReminderById,
  createReminder,
  updateReminder,
  completeReminder,
  snoozeReminder
};
