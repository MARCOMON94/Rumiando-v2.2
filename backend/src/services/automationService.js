const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const ALERT_DAYS = {
  BREEDING_AFTER_PRODUCTION: 150,
  PREGNANCY_DIAGNOSIS_AFTER_BREEDING: 45,
  DRY_OFF_AFTER_GESTATION: 210,
  NO_BIRTH_AFTER: 365
};

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

function daysSince(value, today = new Date()) {
  if (!value) return null;

  const from = startOfDay(new Date(value));
  const to = startOfDay(today);

  if (Number.isNaN(from.getTime())) {
    return null;
  }

  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function getRequiredFarmAccountId(query) {
  const cuentaGanaderaId = Number(
    query.cuentaGanaderaId || process.env.DEMO_CUENTA_GANADERA_ID || 1
  );

  if (!cuentaGanaderaId) {
    throw new AppError('Debe indicarse una cuenta ganadera válida', 400);
  }

  return cuentaGanaderaId;
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

function buildFarmInfo(farmAccount) {
  return {
    id: farmAccount.id,
    name: farmAccount.nombre,
    ownerName: farmAccount.titularNombre,
    contactEmail: farmAccount.emailContacto
  };
}

function buildFarmUnitsInfo(farmAccount) {
  return farmAccount.unidadesRega.map((unit) => ({
    id: unit.id,
    name: unit.nombre,
    code: unit.codigoRega,
    municipality: unit.municipio,
    province: unit.provincia
  }));
}

function buildAnimalInfo(animal) {
  if (!animal) return null;

  return {
    id: animal.id,
    earTag: animal.crotal,
    species: animal.especie?.nombre || null,
    breed: animal.raza?.nombre || null,
    sex: animal.sexo,
    currentPenId: animal.corralActualId,
    currentPen: animal.corralActual?.nombre || null,
    currentReproductiveStatus: animal.estadoReproductivo?.nombre || null,
    farmUnit: animal.unidadRega?.nombre || null
  };
}

function buildAlert({
  type,
  level,
  title,
  reason,
  suggestedAction,
  sourceDate,
  daysElapsed,
  animal = null,
  pen = null,
  extra = {}
}) {
  return {
    type,
    level,
    title,
    reason,
    suggestedAction,
    sourceDate: formatDate(sourceDate),
    daysElapsed,
    animal: buildAnimalInfo(animal),
    penId: pen?.id || animal?.corralActualId || null,
    penName: pen?.nombre || animal?.corralActual?.nombre || 'Sin corral asociado',
    ...extra
  };
}

function getLatestEvent(animal, types) {
  const eventTypes = Array.isArray(types) ? types : [types];

  return animal.eventosReproductivos.find((event) => {
    return eventTypes.includes(event.tipoEvento);
  });
}

function hasEventAfter(animal, date, types) {
  const eventTypes = Array.isArray(types) ? types : [types];

  return animal.eventosReproductivos.some((event) => {
    return (
      eventTypes.includes(event.tipoEvento) &&
      startOfDay(event.fecha).getTime() > startOfDay(date).getTime()
    );
  });
}

function isProductionAnimal(animal) {
  const status = normalizeText(animal.estadoReproductivo?.nombre);

  return status.includes('PRODUCCION') || status.includes('PRODUCTION');
}

function isPregnantAnimal(animal) {
  const status = normalizeText(animal.estadoReproductivo?.nombre);

  return (
    status.includes('GESTANTE') ||
    status.includes('GESTACION') ||
    status.includes('PREGNANT')
  );
}

function groupAlertsByPen(alerts) {
  const groups = {};

  for (const alert of alerts) {
    const penId = alert.penId || 'SIN_CORRAL';
    const penName = alert.penName || 'Sin corral asociado';

    if (!groups[penId]) {
      groups[penId] = {
        penId,
        penName,
        totalAlerts: 0,
        alerts: []
      };
    }

    groups[penId].totalAlerts += 1;
    groups[penId].alerts.push(alert);
  }

  return Object.values(groups);
}

function groupAlertsByType(alerts) {
  const groups = {};

  for (const alert of alerts) {
    if (!groups[alert.type]) {
      groups[alert.type] = {
        type: alert.type,
        title: alert.title,
        level: alert.level,
        totalAlerts: 0
      };
    }

    groups[alert.type].totalAlerts += 1;
  }

  return Object.values(groups);
}

function buildAutomaticAlerts(alerts) {
  return {
    total: alerts.length,
    high: alerts.filter((alert) => alert.level === 'HIGH').length,
    medium: alerts.filter((alert) => alert.level === 'MEDIUM').length,
    low: alerts.filter((alert) => alert.level === 'LOW').length,
    byType: groupAlertsByType(alerts),
    byPen: groupAlertsByPen(alerts),
    items: alerts
  };
}

function buildPriorities(automaticAlerts) {
  const priorities = [];

  if (automaticAlerts.high > 0) {
    priorities.push({
      level: 'HIGH',
      source: 'AUTOMATIC_ALERTS',
      message: `Hay ${automaticAlerts.high} aviso(s) automático(s) de prioridad alta.`
    });
  }

  if (automaticAlerts.medium > 0) {
    priorities.push({
      level: 'MEDIUM',
      source: 'AUTOMATIC_ALERTS',
      message: `Hay ${automaticAlerts.medium} aviso(s) automático(s) de prioridad media.`
    });
  }

  if (automaticAlerts.low > 0) {
    priorities.push({
      level: 'LOW',
      source: 'AUTOMATIC_ALERTS',
      message: `Hay ${automaticAlerts.low} aviso(s) automático(s) de prioridad baja.`
    });
  }

  if (priorities.length === 0) {
    priorities.push({
      level: 'LOW',
      source: 'AUTOMATIC_ALERTS',
      message: 'No hay avisos automáticos calculados para hoy.'
    });
  }

  return priorities;
}

function buildDailyAlerts(animals, mandatoryHealthCases, today) {
  const alerts = [];

  for (const animal of animals) {
    if (animal.sexo !== 'HEMBRA') {
      continue;
    }

    if (
      isProductionAnimal(animal) &&
      animal.fechaEstadoReproductivoActual &&
      daysSince(animal.fechaEstadoReproductivoActual, today) >= ALERT_DAYS.BREEDING_AFTER_PRODUCTION
    ) {
      const daysElapsed = daysSince(animal.fechaEstadoReproductivoActual, today);

      alerts.push(buildAlert({
        type: 'BREEDING_RECOMMENDED_AFTER_PRODUCTION',
        level: 'MEDIUM',
        title: 'Cubrición recomendable',
        reason: `El animal lleva ${daysElapsed} días en estado de producción.`,
        suggestedAction: 'Valorar cubrición según criterio del ganadero o veterinario.',
        sourceDate: animal.fechaEstadoReproductivoActual,
        daysElapsed,
        animal
      }));
    }

    const breedingEvent = getLatestEvent(animal, ['CUBRICION', 'INSEMINACION']);

    if (breedingEvent) {
      const daysElapsed = daysSince(breedingEvent.fecha, today);
      const hasDiagnosisAfter = hasEventAfter(animal, breedingEvent.fecha, 'DIAGNOSTICO_GESTACION');
      const hasBirthOrAbortionAfter = hasEventAfter(animal, breedingEvent.fecha, ['PARTO', 'ABORTO']);

      if (
        daysElapsed >= ALERT_DAYS.PREGNANCY_DIAGNOSIS_AFTER_BREEDING &&
        !hasDiagnosisAfter &&
        !hasBirthOrAbortionAfter
      ) {
        alerts.push(buildAlert({
          type: 'PREGNANCY_DIAGNOSIS_DUE',
          level: 'HIGH',
          title: 'Diagnóstico de gestación pendiente',
          reason: `Han pasado ${daysElapsed} días desde la cubrición/inseminación registrada.`,
          suggestedAction: 'Realizar o registrar diagnóstico de gestación.',
          sourceDate: breedingEvent.fecha,
          daysElapsed,
          animal,
          extra: {
            reproductiveEventId: breedingEvent.id,
            reproductiveEventType: breedingEvent.tipoEvento
          }
        }));
      }
    }

    if (
      isPregnantAnimal(animal) &&
      animal.fechaEstadoReproductivoActual &&
      daysSince(animal.fechaEstadoReproductivoActual, today) >= ALERT_DAYS.DRY_OFF_AFTER_GESTATION
    ) {
      const daysElapsed = daysSince(animal.fechaEstadoReproductivoActual, today);

      alerts.push(buildAlert({
        type: 'DRY_OFF_RECOMMENDED_AFTER_GESTATION',
        level: 'MEDIUM',
        title: 'Paso a seca recomendable',
        reason: `El animal lleva ${daysElapsed} días en estado gestante.`,
        suggestedAction: 'Valorar paso a seca según manejo de la explotación.',
        sourceDate: animal.fechaEstadoReproductivoActual,
        daysElapsed,
        animal
      }));
    }

    const lastBirth = getLatestEvent(animal, 'PARTO');

    if (lastBirth && daysSince(lastBirth.fecha, today) >= ALERT_DAYS.NO_BIRTH_AFTER) {
      const daysElapsed = daysSince(lastBirth.fecha, today);

      alerts.push(buildAlert({
        type: 'NO_BIRTH_IN_LAST_YEAR',
        level: 'MEDIUM',
        title: 'Animal sin parto registrado en el último año',
        reason: `Han pasado ${daysElapsed} días desde el último parto registrado.`,
        suggestedAction: 'Revisar estado reproductivo y valorar nueva cubrición o revisión.',
        sourceDate: lastBirth.fecha,
        daysElapsed,
        animal,
        extra: {
          reproductiveEventId: lastBirth.id
        }
      }));
    }
  }

  for (const healthCase of mandatoryHealthCases) {
    const animal = healthCase.animal || null;
    const pen = animal?.corralActual || healthCase.corral || null;
    const daysElapsed = daysSince(healthCase.fechaInicio, today);

    alerts.push(buildAlert({
      type: 'MANDATORY_DISEASE_DECLARATION_NOTICE',
      level: 'HIGH',
      title: 'Enfermedad de declaración obligatoria',
      reason: `El caso sanitario está asociado a ${healthCase.enfermedad.nombre}, marcada como enfermedad de declaración obligatoria.`,
      suggestedAction: 'Revisar y comunicar a la administración pública según procedimiento aplicable.',
      sourceDate: healthCase.fechaInicio,
      daysElapsed,
      animal,
      pen,
      extra: {
        healthCaseId: healthCase.id,
        disease: healthCase.enfermedad.nombre,
        mandatoryDeclaration: true
      }
    }));
  }

  return alerts;
}

async function getDailyOperationalSummary(query = {}) {
  const cuentaGanaderaId = getRequiredFarmAccountId(query);
  const today = new Date();

  const farmAccount = await getFarmAccount(cuentaGanaderaId);

  const animals = await prisma.animal.findMany({
    where: {
      estadoRegistro: 'ACTIVO',
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: {
      unidadRega: true,
      especie: true,
      raza: true,
      corralActual: true,
      estadoReproductivo: true,
      eventosReproductivos: {
        orderBy: {
          fecha: 'desc'
        }
      }
    },
    orderBy: {
      crotal: 'asc'
    }
  });

  const mandatoryHealthCases = await prisma.casoSanitario.findMany({
    where: {
      estado: 'ABIERTO',
      unidadRega: {
        cuentaGanaderaId
      },
      enfermedad: {
        declaracionObligatoria: true
      }
    },
    include: {
      unidadRega: true,
      enfermedad: true,
      corral: true,
      animal: {
        include: {
          unidadRega: true,
          especie: true,
          raza: true,
          corralActual: true,
          estadoReproductivo: true
        }
      }
    },
    orderBy: {
      fechaInicio: 'desc'
    }
  });

  const alerts = buildDailyAlerts(animals, mandatoryHealthCases, today);
  const automaticAlerts = buildAutomaticAlerts(alerts);
  const priorities = buildPriorities(automaticAlerts);

  return {
    generatedAt: new Date(),
    type: 'DAILY_OPERATIONAL_SUMMARY',
    farm: buildFarmInfo(farmAccount),
    farmUnits: buildFarmUnitsInfo(farmAccount),
    automaticAlerts,
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
    farm: buildFarmInfo(farmAccount),
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