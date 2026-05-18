const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function getRequiredFarmAccountId(query) {
  const cuentaGanaderaId = Number(query.cuentaGanaderaId || process.env.DEMO_CUENTA_GANADERA_ID || 1);

  if (!cuentaGanaderaId) {
    throw new AppError('Debe indicarse una cuenta ganadera válida', 400);
  }

  return cuentaGanaderaId;
}

function groupByPen(items, getPenData) {
  const map = new Map();

  for (const item of items) {
    const penData = getPenData(item);

    const penId = penData?.id || 'SIN_CORRAL';
    const penName = penData?.nombre || 'Sin corral asociado';

    if (!map.has(penId)) {
      map.set(penId, {
        penId,
        penName,
        total: 0,
        items: []
      });
    }

    const group = map.get(penId);
    group.total += 1;
    group.items.push(item);
  }

  return Array.from(map.values());
}

function buildReminderItem(reminder) {
  const animal = reminder.animal;
  const pen = animal?.corralActual || reminder.corral;

  return {
    reminderId: reminder.id,
    type: reminder.tipo,
    targetDate: formatDate(reminder.fechaObjetivo),
    postponedUntil: formatDate(reminder.pospuestoHasta),
    status: reminder.estado,
    originRule: reminder.origenRegla,
    note: reminder.nota,
    animalId: animal?.id || null,
    animalEarTag: animal?.crotal || null,
    species: animal?.especie?.nombre || null,
    breed: animal?.raza?.nombre || null,
    sex: animal?.sexo || null,
    currentPen: pen?.nombre || null,
    farmUnit: animal?.unidadRega?.nombre || reminder.corral?.unidadRega?.nombre || null
  };
}

function buildMovementAlertsFromReminders(reminders) {
  const movementKeywords = [
    'CORRAL',
    'CAMBIO',
    'MOVER',
    'MOVIMIENTO',
    'PREPARTO',
    'PARIDERA',
    'SECADO',
    'DESTETE'
  ];

  const candidates = reminders.filter((reminder) => {
    const text = `${reminder.tipo || ''} ${reminder.nota || ''}`.toUpperCase();

    return reminder.animal && movementKeywords.some((keyword) => text.includes(keyword));
  });

  const items = candidates.map((reminder) => {
    const animal = reminder.animal;
    const currentPen = animal.corralActual;

    return {
      animalId: animal.id,
      earTag: animal.crotal,
      species: animal.especie?.nombre || null,
      breed: animal.raza?.nombre || null,
      sex: animal.sexo,
      currentPen: currentPen?.nombre || null,
      currentReproductiveStatus: animal.estadoReproductivo?.nombre || null,
      suggestedAction: reminder.nota || reminder.tipo,
      reason: `Recordatorio pendiente de tipo ${reminder.tipo}`,
      reminderId: reminder.id,
      targetDate: formatDate(reminder.fechaObjetivo)
    };
  });

  const byPenMap = new Map();

  for (const item of items) {
    const penName = item.currentPen || 'Sin corral actual';

    if (!byPenMap.has(penName)) {
      byPenMap.set(penName, {
        penName,
        totalAnimals: 0,
        animals: []
      });
    }

    const group = byPenMap.get(penName);
    group.totalAnimals += 1;
    group.animals.push(item);
  }

  return {
    total: items.length,
    byPen: Array.from(byPenMap.values())
  };
}

async function getFarmAccount(cuentaGanaderaId) {
  const farmAccount = await prisma.cuentaGanadera.findUnique({
    where: {
      id: cuentaGanaderaId
    },
    include: {
      unidadesRega: true
    }
  });

  if (!farmAccount) {
    throw new AppError('Cuenta ganadera no encontrada', 404);
  }

  return farmAccount;
}

async function getDailyOperationalSummary(query = {}) {
  const cuentaGanaderaId = getRequiredFarmAccountId(query);

  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const nextSevenDays = endOfDay(addDays(new Date(), 7));

  const farmAccount = await getFarmAccount(cuentaGanaderaId);

  const reminders = await prisma.recordatorio.findMany({
    where: {
      cuentaGanaderaId,
      estado: {
        in: ['PENDIENTE', 'POSPUESTO']
      },
      OR: [
        {
          fechaObjetivo: {
            lte: nextSevenDays
          }
        },
        {
          pospuestoHasta: {
            lte: nextSevenDays
          }
        }
      ]
    },
    include: {
      cuentaGanadera: true,
      animal: {
        include: {
          especie: true,
          raza: true,
          corralActual: true,
          unidadRega: true,
          estadoReproductivo: true
        }
      },
      corral: {
        include: {
          unidadRega: true
        }
      }
    },
    orderBy: [
      {
        fechaObjetivo: 'asc'
      },
      {
        createdAt: 'desc'
      }
    ]
  });

  const reminderItems = reminders.map(buildReminderItem);

  const overdue = reminders.filter((reminder) => {
    const effectiveDate = reminder.pospuestoHasta || reminder.fechaObjetivo;
    return effectiveDate < todayStart;
  });

  const dueToday = reminders.filter((reminder) => {
    const effectiveDate = reminder.pospuestoHasta || reminder.fechaObjetivo;
    return effectiveDate >= todayStart && effectiveDate <= todayEnd;
  });

  const reminderGroups = groupByPen(reminderItems, (item) => ({
    id: item.currentPen || 'SIN_CORRAL',
    nombre: item.currentPen || 'Sin corral asociado'
  }));

  const movementAlerts = buildMovementAlertsFromReminders(reminders);

  const priorities = [];

  if (overdue.length > 0) {
    priorities.push({
      level: 'HIGH',
      message: `Hay ${overdue.length} recordatorio(s) vencido(s) que deberían revisarse hoy.`
    });
  }

  if (dueToday.length > 0) {
    priorities.push({
      level: 'MEDIUM',
      message: `Hay ${dueToday.length} recordatorio(s) programado(s) para hoy.`
    });
  }

  if (movementAlerts.total > 0) {
    priorities.push({
      level: 'MEDIUM',
      message: `Hay ${movementAlerts.total} animal(es) con posible cambio de corral o estado.`
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      level: 'LOW',
      message: 'No hay acciones críticas registradas para hoy.'
    });
  }

  return {
    generatedAt: new Date(),
    type: 'DAILY_OPERATIONAL_SUMMARY',
    farm: {
      id: farmAccount.id,
      name: farmAccount.nombre,
      ownerName: farmAccount.titularNombre,
      contactEmail: farmAccount.emailContacto
    },
    farmUnits: farmAccount.unidadesRega.map((unit) => ({
      id: unit.id,
      name: unit.nombre,
      code: unit.codigoRega,
      municipality: unit.municipio,
      province: unit.provincia
    })),
    reminders: {
      totalPending: reminders.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      nextSevenDays: reminders.length - overdue.length - dueToday.length,
      byPen: reminderGroups
    },
    penMovementAlerts: movementAlerts,
    priorities
  };
}

async function getWeeklyHealthSummary(query = {}) {
  const cuentaGanaderaId = getRequiredFarmAccountId(query);

  const today = new Date();
  const weekStart = startOfDay(addDays(today, -7));
  const weekEnd = endOfDay(today);

  const farmAccount = await getFarmAccount(cuentaGanaderaId);

  const healthCases = await prisma.casoSanitario.findMany({
    where: {
      unidadRega: {
        cuentaGanaderaId
      },
      OR: [
        {
          estado: 'ABIERTO'
        },
        {
          fechaInicio: {
            gte: weekStart,
            lte: weekEnd
          }
        }
      ]
    },
    include: {
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
    },
    orderBy: {
      fechaInicio: 'desc'
    }
  });

  const items = healthCases.map((healthCase) => {
    const animal = healthCase.animal;
    const pen = animal?.corralActual || healthCase.corral;

    return {
      caseId: healthCase.id,
      startDate: formatDate(healthCase.fechaInicio),
      status: healthCase.estado,
      animalId: animal?.id || null,
      earTag: animal?.crotal || null,
      species: animal?.especie?.nombre || null,
      breed: animal?.raza?.nombre || null,
      pen: pen?.nombre || null,
      presumptiveDiagnosis: healthCase.diagnosticoPresuntivo,
      confirmedDiagnosis: healthCase.diagnosticoConfirmado,
      clinicalSigns: healthCase.signosClinicos,
      severity: healthCase.gravedad,
      affectsWelfare: healthCase.afectaBienestar,
      isolation: healthCase.lazareto,
      disease: healthCase.enfermedad?.nombre || null,
      mandatoryDeclaration: healthCase.enfermedad?.declaracionObligatoria || false,
      treatments: healthCase.tratamientos.map((treatment) => ({
        id: treatment.id,
        product: treatment.medicamentoProducto,
        activeIngredient: treatment.principioActivo,
        startDate: formatDate(treatment.fechaInicio),
        endDate: formatDate(treatment.fechaFin)
      }))
    };
  });

  const byPenMap = new Map();

  for (const item of items) {
    const penName = item.pen || 'Sin corral asociado';

    if (!byPenMap.has(penName)) {
      byPenMap.set(penName, {
        penName,
        totalCases: 0,
        animals: []
      });
    }

    const group = byPenMap.get(penName);
    group.totalCases += 1;
    group.animals.push(item);
  }

  const mandatoryDeclarationAlerts = items.filter((item) => item.mandatoryDeclaration).length;
  const isolationCases = items.filter((item) => item.isolation).length;
  const activeTreatments = items.reduce((total, item) => {
    return total + item.treatments.filter((treatment) => !treatment.endDate).length;
  }, 0);

  const priorities = [];

  if (mandatoryDeclarationAlerts > 0) {
    priorities.push({
      level: 'HIGH',
      message: `Hay ${mandatoryDeclarationAlerts} caso(s) con enfermedad marcada como declaración obligatoria.`
    });
  }

  if (isolationCases > 0) {
    priorities.push({
      level: 'HIGH',
      message: `Hay ${isolationCases} caso(s) con lazareto activado.`
    });
  }

  if (activeTreatments > 0) {
    priorities.push({
      level: 'MEDIUM',
      message: `Hay ${activeTreatments} tratamiento(s) activo(s) o sin fecha de fin registrada.`
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      level: 'LOW',
      message: 'No hay alertas sanitarias críticas registradas esta semana.'
    });
  }

  return {
    generatedAt: new Date(),
    type: 'WEEKLY_HEALTH_SUMMARY',
    period: {
      from: formatDate(weekStart),
      to: formatDate(weekEnd)
    },
    farm: {
      id: farmAccount.id,
      name: farmAccount.nombre,
      ownerName: farmAccount.titularNombre,
      contactEmail: farmAccount.emailContacto
    },
    health: {
      openCases: healthCases.filter((item) => item.estado === 'ABIERTO').length,
      casesWithIsolation: isolationCases,
      mandatoryDeclarationAlerts,
      activeTreatments,
      byPen: Array.from(byPenMap.values())
    },
    priorities
  };
}

module.exports = {
  getDailyOperationalSummary,
  getWeeklyHealthSummary
};