const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const DEFAULT_ALERT_VALUES = {
  ovino: {
    breedingAfterProduction: 150,
    pregnancyDiagnosis: 45,
    dryOff: 210,
    noBirth: 365,
    expectedGestation: 147
  },
  caprino: {
    breedingAfterProduction: 150,
    pregnancyDiagnosis: 45,
    dryOff: 210,
    noBirth: 365,
    expectedGestation: 150
  }
};

const ALLOWED_KEYS = Object.keys(DEFAULT_ALERT_VALUES.ovino);
const ALLOWED_PRESETS = new Set(['ovino', 'caprino', 'personalizada']);

function scopeKeyFor(unidadRegaId) {
  return unidadRegaId ? String(Number(unidadRegaId)) : 'default';
}

function normalizePreset(value) {
  return ALLOWED_PRESETS.has(value) ? value : 'ovino';
}

function normalizeValues(values = {}, preset = 'ovino') {
  const base = DEFAULT_ALERT_VALUES[preset] || DEFAULT_ALERT_VALUES.ovino;
  const normalized = {};

  for (const key of ALLOWED_KEYS) {
    const raw = values[key] ?? base[key];
    const numeric = Number(raw);
    normalized[key] = Number.isFinite(numeric) && numeric > 0
      ? Math.round(numeric)
      : base[key];
  }

  return normalized;
}

async function checkFarmUnit(unidadRegaId, cuentaGanaderaId) {
  if (!unidadRegaId) return null;

  const farmUnit = await prisma.unidadRega.findFirst({
    where: {
      id: Number(unidadRegaId),
      cuentaGanaderaId
    }
  });

  if (!farmUnit) {
    throw new AppError('Unidad REGA no encontrada para esta cuenta ganadera', 404);
  }

  return farmUnit;
}

async function listAlertSettings(cuentaGanaderaId) {
  const settings = await prisma.alertSettings.findMany({
    where: { cuentaGanaderaId },
    include: {
      unidadRega: {
        include: {
          especiePrincipal: true,
          razaPrincipal: true
        }
      }
    },
    orderBy: [
      { unidadRegaId: 'asc' },
      { id: 'asc' }
    ]
  });

  return {
    defaults: DEFAULT_ALERT_VALUES,
    data: settings
  };
}

async function upsertAlertSettings(cuentaGanaderaId, unidadRegaId, data = {}) {
  const numericFarmUnitId = unidadRegaId && unidadRegaId !== 'default'
    ? Number(unidadRegaId)
    : null;

  await checkFarmUnit(numericFarmUnitId, cuentaGanaderaId);

  const preset = normalizePreset(data.preset);
  const values = normalizeValues(data.values, preset);
  const scopeKey = scopeKeyFor(numericFarmUnitId);

  return prisma.alertSettings.upsert({
    where: {
      cuentaGanaderaId_scopeKey: {
        cuentaGanaderaId,
        scopeKey
      }
    },
    create: {
      cuentaGanaderaId,
      unidadRegaId: numericFarmUnitId,
      scopeKey,
      preset,
      values
    },
    update: {
      unidadRegaId: numericFarmUnitId,
      preset,
      values
    },
    include: {
      unidadRega: {
        include: {
          especiePrincipal: true,
          razaPrincipal: true
        }
      }
    }
  });
}

module.exports = {
  DEFAULT_ALERT_VALUES,
  listAlertSettings,
  upsertAlertSettings
};
