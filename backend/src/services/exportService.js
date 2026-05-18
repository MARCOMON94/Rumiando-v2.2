const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  const safeValue = /^[=+\-@]/.test(stringValue)
    ? `'${stringValue}`
    : stringValue;

  if (
    safeValue.includes(';') ||
    safeValue.includes('"') ||
    safeValue.includes('\n') ||
    safeValue.includes('\r')
  ) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  return safeValue;
}

function buildCsv(headers, rows) {
  const separator = ';';

  const headerLine = headers
    .map((header) => escapeCsvValue(header.label))
    .join(separator);

  const rowLines = rows.map((row) => {
    return headers
      .map((header) => escapeCsvValue(row[header.key]))
      .join(separator);
  });

  return `\uFEFF${[headerLine, ...rowLines].join('\n')}`;
}

function buildDateFilter(filters = {}, fieldName) {
  const filter = {};

  if (filters.fechaDesde) {
    filter.gte = new Date(filters.fechaDesde);
  }

  if (filters.fechaHasta) {
    filter.lte = new Date(filters.fechaHasta);
  }

  if (Object.keys(filter).length === 0) {
    return {};
  }

  return {
    [fieldName]: filter
  };
}

async function exportAnimals(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: {
      cuentaGanaderaId
    },
    ...buildDateFilter(filters, 'fechaEntrada')
  };

  if (filters.unidadRegaId) {
    where.unidadRegaId = Number(filters.unidadRegaId);
  }

  if (filters.especieId) {
    where.especieId = Number(filters.especieId);
  }

  if (filters.corralActualId) {
    where.corralActualId = Number(filters.corralActualId);
  }

  if (filters.estadoRegistro) {
    where.estadoRegistro = filters.estadoRegistro;
  }

  const animals = await prisma.animal.findMany({
    where,
    include: {
      unidadRega: true,
      especie: true,
      raza: true,
      corralActual: true,
      estadoReproductivo: true,
      madre: {
        select: {
          crotal: true
        }
      },
      padre: {
        select: {
          crotal: true
        }
      }
    },
    orderBy: {
      crotal: 'asc'
    }
  });

  const rows = animals.map((animal) => ({
    id: animal.id,
    crotal: animal.crotal,
    numeroInterno: animal.numeroInterno,
    sexo: animal.sexo,
    fechaNacimiento: formatDate(animal.fechaNacimiento),
    fechaEntrada: formatDate(animal.fechaEntrada),
    estadoRegistro: animal.estadoRegistro,
    unidadRega: animal.unidadRega?.nombre,
    codigoRega: animal.unidadRega?.codigoRega,
    especie: animal.especie?.nombre,
    raza: animal.raza?.nombre,
    corralActual: animal.corralActual?.nombre,
    estadoReproductivo: animal.estadoReproductivo?.nombre,
    madre: animal.madre?.crotal,
    padre: animal.padre?.crotal,
    origen: animal.origen,
    fechaSalida: formatDate(animal.fechaSalida),
    destinoSalida: animal.destinoSalida,
    observaciones: animal.observaciones
  }));

  return buildCsv(
    [
      { key: 'id', label: 'ID' },
      { key: 'crotal', label: 'Crotal' },
      { key: 'numeroInterno', label: 'Número interno' },
      { key: 'sexo', label: 'Sexo' },
      { key: 'fechaNacimiento', label: 'Fecha nacimiento' },
      { key: 'fechaEntrada', label: 'Fecha entrada' },
      { key: 'estadoRegistro', label: 'Estado registro' },
      { key: 'unidadRega', label: 'Unidad REGA' },
      { key: 'codigoRega', label: 'Código REGA' },
      { key: 'especie', label: 'Especie' },
      { key: 'raza', label: 'Raza' },
      { key: 'corralActual', label: 'Corral actual' },
      { key: 'estadoReproductivo', label: 'Estado reproductivo' },
      { key: 'madre', label: 'Madre' },
      { key: 'padre', label: 'Padre' },
      { key: 'origen', label: 'Origen' },
      { key: 'fechaSalida', label: 'Fecha salida' },
      { key: 'destinoSalida', label: 'Destino salida' },
      { key: 'observaciones', label: 'Observaciones' }
    ],
    rows
  );
}

async function exportHealthCases(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: {
      cuentaGanaderaId
    },
    ...buildDateFilter(filters, 'fechaInicio')
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

  if (filters.estado) {
    where.estado = filters.estado;
  }

  const healthCases = await prisma.casoSanitario.findMany({
    where,
    include: {
      unidadRega: true,
      animal: true,
      corral: true,
      enfermedad: true
    },
    orderBy: {
      fechaInicio: 'desc'
    }
  });

  const rows = healthCases.map((healthCase) => ({
    id: healthCase.id,
    fechaInicio: formatDate(healthCase.fechaInicio),
    fechaCierre: formatDate(healthCase.fechaCierre),
    estado: healthCase.estado,
    animal: healthCase.animal?.crotal,
    corral: healthCase.corral?.nombre,
    unidadRega: healthCase.unidadRega?.nombre,
    enfermedad: healthCase.enfermedad?.nombre,
    declaracionObligatoria: healthCase.enfermedad?.declaracionObligatoria,
    signosClinicos: healthCase.signosClinicos,
    diagnosticoPresuntivo: healthCase.diagnosticoPresuntivo,
    diagnosticoConfirmado: healthCase.diagnosticoConfirmado,
    gravedad: healthCase.gravedad,
    afectaBienestar: healthCase.afectaBienestar,
    lazareto: healthCase.lazareto,
    resultado: healthCase.resultado
  }));

  return buildCsv(
    [
      { key: 'id', label: 'ID' },
      { key: 'fechaInicio', label: 'Fecha inicio' },
      { key: 'fechaCierre', label: 'Fecha cierre' },
      { key: 'estado', label: 'Estado' },
      { key: 'animal', label: 'Animal' },
      { key: 'corral', label: 'Corral' },
      { key: 'unidadRega', label: 'Unidad REGA' },
      { key: 'enfermedad', label: 'Enfermedad' },
      { key: 'declaracionObligatoria', label: 'Declaración obligatoria' },
      { key: 'signosClinicos', label: 'Signos clínicos' },
      { key: 'diagnosticoPresuntivo', label: 'Diagnóstico presuntivo' },
      { key: 'diagnosticoConfirmado', label: 'Diagnóstico confirmado' },
      { key: 'gravedad', label: 'Gravedad' },
      { key: 'afectaBienestar', label: 'Afecta bienestar' },
      { key: 'lazareto', label: 'Lazareto' },
      { key: 'resultado', label: 'Resultado' }
    ],
    rows
  );
}

async function exportMovements(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: {
      cuentaGanaderaId
    },
    ...buildDateFilter(filters, 'fecha')
  };

  if (filters.unidadRegaId) {
    where.unidadRegaId = Number(filters.unidadRegaId);
  }

  if (filters.corralDestinoId) {
    where.corralDestinoId = Number(filters.corralDestinoId);
  }

  if (filters.tipoOperacion) {
    where.tipoOperacion = filters.tipoOperacion;
  }

  const movements = await prisma.movimientoTransaccion.findMany({
    where,
    include: {
      unidadRega: true,
      corralOrigen: true,
      corralDestino: true,
      user: {
        select: {
          nombre: true,
          email: true
        }
      },
      detalles: {
        include: {
          animal: true,
          corralOrigen: true,
          corralDestino: true
        }
      }
    },
    orderBy: {
      fecha: 'desc'
    }
  });

  const rows = [];

  for (const movement of movements) {
    for (const detail of movement.detalles) {
      rows.push({
        movimientoId: movement.id,
        fecha: formatDate(movement.fecha),
        tipoOperacion: movement.tipoOperacion,
        motivo: movement.motivo,
        unidadRega: movement.unidadRega?.nombre,
        corralOrigenMovimiento: movement.corralOrigen?.nombre,
        corralDestinoMovimiento: movement.corralDestino?.nombre,
        usuario: movement.user?.nombre,
        emailUsuario: movement.user?.email,
        detalleId: detail.id,
        crotalLeido: detail.crotalLeido,
        animal: detail.animal?.crotal,
        estadoProceso: detail.estadoProceso,
        corralOrigenDetalle: detail.corralOrigen?.nombre,
        corralDestinoDetalle: detail.corralDestino?.nombre,
        observaciones: detail.observaciones
      });
    }
  }

  return buildCsv(
    [
      { key: 'movimientoId', label: 'ID movimiento' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'tipoOperacion', label: 'Tipo operación' },
      { key: 'motivo', label: 'Motivo' },
      { key: 'unidadRega', label: 'Unidad REGA' },
      { key: 'corralOrigenMovimiento', label: 'Corral origen movimiento' },
      { key: 'corralDestinoMovimiento', label: 'Corral destino movimiento' },
      { key: 'usuario', label: 'Usuario' },
      { key: 'emailUsuario', label: 'Email usuario' },
      { key: 'detalleId', label: 'ID detalle' },
      { key: 'crotalLeido', label: 'Crotal leído' },
      { key: 'animal', label: 'Animal encontrado' },
      { key: 'estadoProceso', label: 'Estado proceso' },
      { key: 'corralOrigenDetalle', label: 'Corral origen detalle' },
      { key: 'corralDestinoDetalle', label: 'Corral destino detalle' },
      { key: 'observaciones', label: 'Observaciones' }
    ],
    rows
  );
}

async function exportReminders(cuentaGanaderaId, filters = {}) {
  const where = {
    cuentaGanaderaId,
    ...buildDateFilter(filters, 'fechaObjetivo')
  };

  if (filters.estado) {
    where.estado = filters.estado;
  }

  if (filters.tipo) {
    where.tipo = filters.tipo;
  }

  if (filters.animalId) {
    where.animalId = Number(filters.animalId);
  }

  if (filters.corralId) {
    where.corralId = Number(filters.corralId);
  }

  const reminders = await prisma.recordatorio.findMany({
    where,
    include: {
      animal: true,
      corral: true
    },
    orderBy: {
      fechaObjetivo: 'asc'
    }
  });

  const rows = reminders.map((reminder) => ({
    id: reminder.id,
    tipo: reminder.tipo,
    fechaObjetivo: formatDate(reminder.fechaObjetivo),
    estado: reminder.estado,
    pospuestoHasta: formatDate(reminder.pospuestoHasta),
    origenRegla: reminder.origenRegla,
    animal: reminder.animal?.crotal,
    corral: reminder.corral?.nombre,
    nota: reminder.nota,
    createdAt: formatDate(reminder.createdAt)
  }));

  return buildCsv(
    [
      { key: 'id', label: 'ID' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'fechaObjetivo', label: 'Fecha objetivo' },
      { key: 'estado', label: 'Estado' },
      { key: 'pospuestoHasta', label: 'Pospuesto hasta' },
      { key: 'origenRegla', label: 'Origen regla' },
      { key: 'animal', label: 'Animal' },
      { key: 'corral', label: 'Corral' },
      { key: 'nota', label: 'Nota' },
      { key: 'createdAt', label: 'Fecha creación' }
    ],
    rows
  );
}


function validateExportRequest(data) {
  const allowedTypes = ['CENSO', 'VETERINARIO'];

  if (!data.tipoExportacion) {
    throw new AppError('El tipo de exportación es obligatorio.', 400);
  }

  if (!allowedTypes.includes(data.tipoExportacion)) {
    throw new AppError('El tipo de exportación no es válido.', 400);
  }

  if (!data.fechaDesde) {
    throw new AppError('La fecha desde es obligatoria.', 400);
  }

  if (!data.fechaHasta) {
    throw new AppError('La fecha hasta es obligatoria.', 400);
  }

  if (!data.emailDestino) {
    throw new AppError('El email de destino es obligatorio.', 400);
  }

  const fechaDesde = new Date(data.fechaDesde);
  const fechaHasta = new Date(data.fechaHasta);

  if (Number.isNaN(fechaDesde.getTime()) || Number.isNaN(fechaHasta.getTime())) {
    throw new AppError('Las fechas de exportación no son válidas.', 400);
  }

  if (fechaDesde > fechaHasta) {
    throw new AppError('La fecha desde no puede ser posterior a la fecha hasta.', 400);
  }

  return {
    tipoExportacion: data.tipoExportacion,
    fechaDesde,
    fechaHasta,
    emailDestino: data.emailDestino,
    unidadRegaId: data.unidadRegaId ? Number(data.unidadRegaId) : null
  };
}

async function sendToN8n(payload) {
  const webhookUrl = process.env.N8N_EXPORT_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      sent: false,
      mode: 'SIMULATED',
      message: 'No hay webhook de n8n configurado. La solicitud queda registrada como pendiente.'
    };
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let responseBody;

  try {
    responseBody = text ? JSON.parse(text) : null;
  } catch (error) {
    responseBody = text;
  }

  if (!response.ok) {
    return {
      sent: false,
      mode: 'N8N',
      status: response.status,
      response: responseBody
    };
  }

  return {
    sent: true,
    mode: 'N8N',
    status: response.status,
    response: responseBody
  };
}

async function sendExportRequest(cuentaGanaderaId, data) {
  const validatedData = validateExportRequest(data);

  if (validatedData.unidadRegaId) {
    const farmUnit = await prisma.unidadRega.findFirst({
      where: {
        id: validatedData.unidadRegaId,
        cuentaGanaderaId
      }
    });

    if (!farmUnit) {
      throw new AppError('La unidad REGA indicada no existe para esta cuenta.', 404);
    }
  }

  const createdExport = await prisma.exportacionRegistro.create({
    data: {
      tipoExportacion: validatedData.tipoExportacion,
      fechaDesde: validatedData.fechaDesde,
      fechaHasta: validatedData.fechaHasta,
      emailDestino: validatedData.emailDestino,
      estadoEnvio: 'PENDIENTE',
      cuentaGanaderaId,
      unidadRegaId: validatedData.unidadRegaId
    }
  });

  const n8nPayload = {
    exportacionId: createdExport.id,
    tipoExportacion: createdExport.tipoExportacion,
    fechaDesde: createdExport.fechaDesde,
    fechaHasta: createdExport.fechaHasta,
    emailDestino: createdExport.emailDestino,
    cuentaGanaderaId: createdExport.cuentaGanaderaId,
    unidadRegaId: createdExport.unidadRegaId
  };

  const n8nResponse = await sendToN8n(n8nPayload);

  const updatedExport = await prisma.exportacionRegistro.update({
    where: {
      id: createdExport.id
    },
    data: {
      estadoEnvio: n8nResponse.sent ? 'ENVIADO' : 'PENDIENTE',
      respuestaN8n: n8nResponse
    }
  });

  return updatedExport;
}


module.exports = {
  exportAnimals,
  exportHealthCases,
  exportMovements,
  exportReminders,
  sendExportRequest
};