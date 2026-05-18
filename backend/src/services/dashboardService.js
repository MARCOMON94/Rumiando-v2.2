const prisma = require('../config/prisma');

async function getTotals(cuentaGanaderaId) {
  const [
    totalAnimals,
    activeAnimals,
    openHealthCases,
    pendingReminders,
    totalPens,
    totalFarmUnits,
    totalMovements
  ] = await Promise.all([
    prisma.animal.count({
      where: {
        unidadRega: {
          cuentaGanaderaId
        }
      }
    }),

    prisma.animal.count({
      where: {
        estadoRegistro: 'ACTIVO',
        unidadRega: {
          cuentaGanaderaId
        }
      }
    }),

    prisma.casoSanitario.count({
      where: {
        estado: 'ABIERTO',
        unidadRega: {
          cuentaGanaderaId
        }
      }
    }),

    prisma.recordatorio.count({
      where: {
        cuentaGanaderaId,
        estado: {
          in: ['PENDIENTE', 'POSPUESTO']
        }
      }
    }),

    prisma.corral.count({
      where: {
        unidadRega: {
          cuentaGanaderaId
        }
      }
    }),

    prisma.unidadRega.count({
      where: {
        cuentaGanaderaId
      }
    }),

    prisma.movimientoTransaccion.count({
      where: {
        unidadRega: {
          cuentaGanaderaId
        }
      }
    })
  ]);

  return {
    totalAnimals,
    activeAnimals,
    openHealthCases,
    pendingReminders,
    totalPens,
    totalFarmUnits,
    totalMovements
  };
}

async function getAnimalsBySpecies(cuentaGanaderaId) {
  const species = await prisma.catalogoEspecie.findMany({
    where: {
      cuentaGanaderaId
    },
    include: {
      _count: {
        select: {
          animales: true
        }
      }
    },
    orderBy: {
      nombre: 'asc'
    }
  });

  return species.map((item) => ({
    id: item.id,
    name: item.nombre,
    total: item._count.animales
  }));
}

async function getAnimalsByPen(cuentaGanaderaId) {
  const pens = await prisma.corral.findMany({
    where: {
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: {
      unidadRega: true,
      _count: {
        select: {
          animalesActuales: true
        }
      }
    },
    orderBy: {
      nombre: 'asc'
    }
  });

  return pens.map((pen) => ({
    id: pen.id,
    name: pen.nombre,
    farmUnit: pen.unidadRega?.nombre,
    total: pen._count.animalesActuales
  }));
}

async function getRecentMovements(cuentaGanaderaId) {
  return prisma.movimientoTransaccion.findMany({
    where: {
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: {
      unidadRega: true,
      corralOrigen: true,
      corralDestino: true,
      user: {
        select: {
          id: true,
          nombre: true,
          email: true
        }
      },
      detalles: true
    },
    orderBy: {
      fecha: 'desc'
    },
    take: 5
  });
}

async function getUpcomingReminders(cuentaGanaderaId) {
  return prisma.recordatorio.findMany({
    where: {
      cuentaGanaderaId,
      estado: {
        in: ['PENDIENTE', 'POSPUESTO']
      }
    },
    include: {
      animal: true,
      corral: true
    },
    orderBy: {
      fechaObjetivo: 'asc'
    },
    take: 5
  });
}

async function getHealthCasesByStatus(cuentaGanaderaId) {
  const healthCases = await prisma.casoSanitario.groupBy({
    by: ['estado'],
    where: {
      unidadRega: {
        cuentaGanaderaId
      }
    },
    _count: {
      estado: true
    }
  });

  return healthCases.map((item) => ({
    status: item.estado,
    total: item._count.estado
  }));
}

async function getDashboard(cuentaGanaderaId) {
  const [
    totals,
    animalsBySpecies,
    animalsByPen,
    recentMovements,
    upcomingReminders,
    healthCasesByStatus
  ] = await Promise.all([
    getTotals(cuentaGanaderaId),
    getAnimalsBySpecies(cuentaGanaderaId),
    getAnimalsByPen(cuentaGanaderaId),
    getRecentMovements(cuentaGanaderaId),
    getUpcomingReminders(cuentaGanaderaId),
    getHealthCasesByStatus(cuentaGanaderaId)
  ]);

  return {
    totals,
    animalsBySpecies,
    animalsByPen,
    recentMovements,
    upcomingReminders,
    healthCasesByStatus
  };
}

module.exports = {
  getDashboard
};