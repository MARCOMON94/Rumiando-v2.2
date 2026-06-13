const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

const RULE_TYPES = new Set(['CORRAL_A_REPRODUCCION', 'REPRODUCCION_A_CORRAL']);
const REPRODUCTIVE_EVENTS = new Set([
  'CUBRICION',
  'INSEMINACION',
  'DIAGNOSTICO_GESTACION',
  'PARTO',
  'ABORTO',
  'SECADO',
  'BAJA_REPRODUCTIVA',
  'REVISION_REPRODUCTIVA'
]);
const EVENT_RESULTS = new Set(['POSITIVO', 'NEGATIVO', 'DUDOSO', 'NO_APLICA']);

function getRuleInclude() {
  return {
    unidadRega: true,
    triggerCorral: {
      include: {
        unidadRega: true
      }
    },
    targetCorral: {
      include: {
        unidadRega: true
      }
    },
    triggerEstadoReproductivo: true,
    targetEstadoReproductivo: true
  };
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return Number(value);
}

function toNullableEnum(value, allowedValues, message) {
  if (!value) return null;

  if (!allowedValues.has(value)) {
    throw new AppError(message, 400);
  }

  return value;
}

async function checkFarmUnit(unidadRegaId, cuentaGanaderaId) {
  if (!unidadRegaId) return null;

  const unit = await prisma.unidadRega.findFirst({
    where: {
      id: Number(unidadRegaId),
      cuentaGanaderaId
    }
  });

  if (!unit) {
    throw new AppError('La unidad REGA indicada no existe o no pertenece a esta cuenta', 404);
  }

  return unit;
}

async function checkPen(corralId, cuentaGanaderaId) {
  if (!corralId) return null;

  const pen = await prisma.corral.findFirst({
    where: {
      id: Number(corralId),
      activo: true,
      unidadRega: {
        cuentaGanaderaId
      }
    },
    include: {
      unidadRega: true
    }
  });

  if (!pen) {
    throw new AppError('El corral indicado no existe o no pertenece a esta cuenta', 404);
  }

  return pen;
}

async function checkReproductiveStatus(estadoReproductivoId, cuentaGanaderaId) {
  if (!estadoReproductivoId) return null;

  const status = await prisma.catalogoEstadoReproductivo.findFirst({
    where: {
      id: Number(estadoReproductivoId),
      cuentaGanaderaId
    }
  });

  if (!status) {
    throw new AppError('El estado reproductivo indicado no existe', 404);
  }

  return status;
}

function assertSameUnit(ruleData, unit, triggerPen, targetPen) {
  if (!unit) return;

  if (triggerPen && triggerPen.unidadRegaId !== unit.id) {
    throw new AppError('El corral disparador no pertenece a la unidad REGA seleccionada', 400);
  }

  if (targetPen && targetPen.unidadRegaId !== unit.id) {
    throw new AppError('El corral destino no pertenece a la unidad REGA seleccionada', 400);
  }
}

async function normalizeRuleData(data, cuentaGanaderaId) {
  const tipo = data.tipo;

  if (!RULE_TYPES.has(tipo)) {
    throw new AppError('El tipo de regla de manejo no es válido', 400);
  }

  const normalized = {
    tipo,
    activo: data.activo === undefined ? true : Boolean(data.activo),
    cuentaGanaderaId,
    unidadRegaId: toNullableNumber(data.unidadRegaId),
    triggerCorralId: toNullableNumber(data.triggerCorralId),
    triggerEstadoReproductivoId: toNullableNumber(data.triggerEstadoReproductivoId),
    triggerEventoReproductivo: toNullableEnum(
      data.triggerEventoReproductivo,
      REPRODUCTIVE_EVENTS,
      'El evento reproductivo disparador no es válido'
    ),
    targetCorralId: toNullableNumber(data.targetCorralId),
    targetEstadoReproductivoId: toNullableNumber(data.targetEstadoReproductivoId),
    targetEventoReproductivo: toNullableEnum(
      data.targetEventoReproductivo,
      REPRODUCTIVE_EVENTS,
      'El evento reproductivo destino no es válido'
    ),
    targetResultadoEvento: toNullableEnum(
      data.targetResultadoEvento,
      EVENT_RESULTS,
      'El resultado reproductivo destino no es válido'
    )
  };

  if (tipo === 'CORRAL_A_REPRODUCCION') {
    normalized.triggerEstadoReproductivoId = null;
    normalized.triggerEventoReproductivo = null;
    normalized.targetCorralId = null;

    if (!normalized.triggerCorralId) {
      throw new AppError('Selecciona el corral que dispara la regla', 400);
    }

    if (!normalized.targetEstadoReproductivoId && !normalized.targetEventoReproductivo) {
      throw new AppError('Selecciona un estado o evento reproductivo destino', 400);
    }
  }

  if (tipo === 'REPRODUCCION_A_CORRAL') {
    normalized.triggerCorralId = null;
    normalized.targetEstadoReproductivoId = null;
    normalized.targetEventoReproductivo = null;
    normalized.targetResultadoEvento = null;

    if (!normalized.targetCorralId) {
      throw new AppError('Selecciona el corral destino de la regla', 400);
    }

    if (!normalized.triggerEstadoReproductivoId && !normalized.triggerEventoReproductivo) {
      throw new AppError('Selecciona un estado o evento reproductivo disparador', 400);
    }
  }

  const [unit, triggerPen, targetPen] = await Promise.all([
    checkFarmUnit(normalized.unidadRegaId, cuentaGanaderaId),
    checkPen(normalized.triggerCorralId, cuentaGanaderaId),
    checkPen(normalized.targetCorralId, cuentaGanaderaId),
    checkReproductiveStatus(normalized.triggerEstadoReproductivoId, cuentaGanaderaId),
    checkReproductiveStatus(normalized.targetEstadoReproductivoId, cuentaGanaderaId)
  ]);

  assertSameUnit(normalized, unit, triggerPen, targetPen);

  return normalized;
}

function buildWhere(cuentaGanaderaId, filters = {}) {
  const where = {
    cuentaGanaderaId
  };

  if (filters.tipo) where.tipo = filters.tipo;

  if (filters.activo !== undefined) {
    where.activo = String(filters.activo) === 'true';
  }

  if (filters.unidadRegaId) where.unidadRegaId = Number(filters.unidadRegaId);
  if (filters.triggerCorralId) where.triggerCorralId = Number(filters.triggerCorralId);
  if (filters.targetCorralId) where.targetCorralId = Number(filters.targetCorralId);
  if (filters.triggerEstadoReproductivoId) {
    where.triggerEstadoReproductivoId = Number(filters.triggerEstadoReproductivoId);
  }
  if (filters.triggerEventoReproductivo) {
    where.triggerEventoReproductivo = filters.triggerEventoReproductivo;
  }

  return where;
}

async function listManagementRules(cuentaGanaderaId, filters = {}) {
  return prisma.managementRule.findMany({
    where: buildWhere(cuentaGanaderaId, filters),
    include: getRuleInclude(),
    orderBy: [
      { tipo: 'asc' },
      { id: 'asc' }
    ]
  });
}

async function getManagementRuleById(id, cuentaGanaderaId) {
  const rule = await prisma.managementRule.findFirst({
    where: {
      id,
      cuentaGanaderaId
    },
    include: getRuleInclude()
  });

  if (!rule) {
    throw new AppError('Regla de manejo no encontrada', 404);
  }

  return rule;
}

async function createManagementRule(data, cuentaGanaderaId) {
  const normalized = await normalizeRuleData(data, cuentaGanaderaId);

  return prisma.managementRule.create({
    data: normalized,
    include: getRuleInclude()
  });
}

async function updateManagementRule(id, data, cuentaGanaderaId) {
  const current = await getManagementRuleById(id, cuentaGanaderaId);
  const merged = {
    tipo: current.tipo,
    activo: current.activo,
    unidadRegaId: current.unidadRegaId,
    triggerCorralId: current.triggerCorralId,
    triggerEstadoReproductivoId: current.triggerEstadoReproductivoId,
    triggerEventoReproductivo: current.triggerEventoReproductivo,
    targetCorralId: current.targetCorralId,
    targetEstadoReproductivoId: current.targetEstadoReproductivoId,
    targetEventoReproductivo: current.targetEventoReproductivo,
    targetResultadoEvento: current.targetResultadoEvento,
    ...data
  };
  const normalized = await normalizeRuleData(merged, cuentaGanaderaId);

  return prisma.managementRule.update({
    where: {
      id
    },
    data: normalized,
    include: getRuleInclude()
  });
}

async function deleteManagementRule(id, cuentaGanaderaId) {
  await getManagementRuleById(id, cuentaGanaderaId);

  await prisma.managementRule.delete({
    where: {
      id
    }
  });

  return {
    deleted: true
  };
}

module.exports = {
  listManagementRules,
  getManagementRuleById,
  createManagementRule,
  updateManagementRule,
  deleteManagementRule
};
