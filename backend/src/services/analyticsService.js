const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { buildWorkbook } = require('./xlsxService');

const DATASET_LABELS = {
  animals: 'Censo de animales',
  discharges: 'Bajas',
  reproductive: 'Eventos reproductivos',
  health: 'Eventos sanitarios'
};

function asDate(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getDataset(body = {}) {
  return DATASET_LABELS[body.dataset] ? body.dataset : 'animals';
}

function getGroupValue(row, groupBy) {
  if (!groupBy) return 'Total';
  return row[groupBy] || 'Sin dato';
}

function groupRows(rows, groupBy) {
  const grouped = new Map();
  for (const row of rows) {
    const label = getGroupValue(row, groupBy);
    grouped.set(label, (grouped.get(label) || 0) + 1);
  }

  const total = rows.length || 1;
  return [...grouped.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: Number(((value / total) * 100).toFixed(1))
    }))
    .sort((a, b) => b.value - a.value || String(a.label).localeCompare(String(b.label), 'es'));
}

function chartTypeFor(rows, groupBy) {
  if (!groupBy) return 'bar';
  if (groupBy === 'period') return 'line';
  return rows.length <= 7 ? 'pie' : 'bar';
}

async function getOptions(cuentaGanaderaId) {
  const [farmUnits, pens, reproductiveStatuses, species, breeds, diseases] = await Promise.all([
    prisma.unidadRega.findMany({
      where: { cuentaGanaderaId, activa: true },
      include: {
        especiePrincipal: true,
        razaPrincipal: true
      },
      orderBy: { nombre: 'asc' }
    }),
    prisma.corral.findMany({
      where: {
        activo: true,
        unidadRega: { cuentaGanaderaId }
      },
      include: { unidadRega: true },
      orderBy: { nombre: 'asc' }
    }),
    prisma.catalogoEstadoReproductivo.findMany({
      where: { cuentaGanaderaId, activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }]
    }),
    prisma.catalogoEspecie.findMany({
      where: { cuentaGanaderaId, activo: true },
      orderBy: { nombre: 'asc' }
    }),
    prisma.catalogoRaza.findMany({
      where: { cuentaGanaderaId, activo: true },
      include: { especie: true },
      orderBy: { nombre: 'asc' }
    }),
    prisma.catalogoEnfermedad.findMany({
      where: { cuentaGanaderaId, activo: true },
      orderBy: { nombre: 'asc' }
    })
  ]);

  return {
    datasets: Object.entries(DATASET_LABELS).map(([value, label]) => ({ value, label })),
    groupBy: [
      { value: 'unidadRega', label: 'REGA' },
      { value: 'corral', label: 'Corral' },
      { value: 'estadoReproductivo', label: 'Estado reproductivo' },
      { value: 'especie', label: 'Especie' },
      { value: 'raza', label: 'Raza' },
      { value: 'sexo', label: 'Sexo' },
      { value: 'estadoRegistro', label: 'Estado de registro' },
      { value: 'period', label: 'Periodo' }
    ],
    farmUnits,
    pens,
    reproductiveStatuses,
    species,
    breeds,
    diseases
  };
}

function farmUnitLabel(unit) {
  if (!unit) return '';
  const species = unit.especiePrincipal?.nombre;
  const breed = unit.razaPrincipal?.nombre;
  const suffix = [species, breed].filter(Boolean).join(' · ');
  const base = unit.nombre || unit.codigoRega;
  return suffix ? `${base} (${suffix})` : base;
}

function applyCommonAnimalFilters(where, filters = {}) {
  if (filters.unidadRegaId) where.unidadRegaId = Number(filters.unidadRegaId);
  if (filters.corralId) where.corralActualId = Number(filters.corralId);
  if (filters.estadoReproductivoId) where.estadoReproductivoId = Number(filters.estadoReproductivoId);
  if (filters.especieId) where.especieId = Number(filters.especieId);
  if (filters.razaId) where.razaId = Number(filters.razaId);
  if (filters.sexo) where.sexo = filters.sexo;
  if (filters.estadoRegistro) where.estadoRegistro = filters.estadoRegistro;
}

function periodLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function animalRow(animal) {
  return {
    id: animal.id,
    crotal: animal.crotal,
    unidadRega: farmUnitLabel(animal.unidadRega),
    codigoRega: animal.unidadRega?.codigoRega,
    corral: animal.corralActual?.nombre,
    estadoReproductivo: animal.estadoReproductivo?.nombre,
    especie: animal.especie?.nombre,
    raza: animal.raza?.nombre,
    sexo: animal.sexo,
    estadoRegistro: animal.estadoRegistro,
    fechaEntrada: formatDate(animal.fechaEntrada),
    fechaSalida: formatDate(animal.fechaSalida),
    period: periodLabel(animal.fechaSalida || animal.fechaEntrada)
  };
}

async function queryAnimals(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: { cuentaGanaderaId }
  };
  applyCommonAnimalFilters(where, filters);

  const fechaDesde = asDate(filters.fechaDesde);
  const fechaHasta = asDate(filters.fechaHasta, true);
  if (fechaDesde || fechaHasta) {
    where.fechaEntrada = {};
    if (fechaDesde) where.fechaEntrada.gte = fechaDesde;
    if (fechaHasta) where.fechaEntrada.lte = fechaHasta;
  }

  const animals = await prisma.animal.findMany({
    where,
    include: {
      unidadRega: {
        include: {
          especiePrincipal: true,
          razaPrincipal: true
        }
      },
      corralActual: true,
      estadoReproductivo: true,
      especie: true,
      raza: true
    },
    orderBy: { crotal: 'asc' }
  });

  return animals.map(animalRow);
}

async function queryDischarges(cuentaGanaderaId, filters = {}) {
  const where = {
    estadoRegistro: 'BAJA',
    unidadRega: { cuentaGanaderaId }
  };
  applyCommonAnimalFilters(where, filters);

  const fechaDesde = asDate(filters.fechaDesde);
  const fechaHasta = asDate(filters.fechaHasta, true);
  if (fechaDesde || fechaHasta) {
    where.fechaSalida = {};
    if (fechaDesde) where.fechaSalida.gte = fechaDesde;
    if (fechaHasta) where.fechaSalida.lte = fechaHasta;
  }

  const animals = await prisma.animal.findMany({
    where,
    include: {
      unidadRega: {
        include: {
          especiePrincipal: true,
          razaPrincipal: true
        }
      },
      corralActual: true,
      estadoReproductivo: true,
      especie: true,
      raza: true
    },
    orderBy: { fechaSalida: 'desc' }
  });

  return animals.map(animalRow);
}

async function queryReproductive(cuentaGanaderaId, filters = {}) {
  const where = {
    animal: {
      unidadRega: { cuentaGanaderaId }
    }
  };
  if (filters.unidadRegaId) where.animal.unidadRegaId = Number(filters.unidadRegaId);
  if (filters.tipoEvento) where.tipoEvento = filters.tipoEvento;
  if (filters.resultado) where.resultado = filters.resultado;

  const fechaDesde = asDate(filters.fechaDesde);
  const fechaHasta = asDate(filters.fechaHasta, true);
  if (fechaDesde || fechaHasta) {
    where.fecha = {};
    if (fechaDesde) where.fecha.gte = fechaDesde;
    if (fechaHasta) where.fecha.lte = fechaHasta;
  }

  const events = await prisma.eventoReproductivo.findMany({
    where,
    include: {
      animal: {
        include: {
          unidadRega: {
            include: {
              especiePrincipal: true,
              razaPrincipal: true
            }
          },
          corralActual: true,
          estadoReproductivo: true,
          especie: true,
          raza: true
        }
      },
      estadoResultante: true
    },
    orderBy: { fecha: 'desc' }
  });

  return events.map((event) => ({
    id: event.id,
    fecha: formatDate(event.fecha),
    period: periodLabel(event.fecha),
    tipoEvento: event.tipoEvento,
    resultado: event.resultado,
    crotal: event.animal?.crotal,
    unidadRega: farmUnitLabel(event.animal?.unidadRega),
    corral: event.animal?.corralActual?.nombre,
    estadoReproductivo: event.estadoResultante?.nombre || event.animal?.estadoReproductivo?.nombre,
    especie: event.animal?.especie?.nombre,
    raza: event.animal?.raza?.nombre,
    sexo: event.animal?.sexo
  }));
}

async function queryHealth(cuentaGanaderaId, filters = {}) {
  const where = {
    unidadRega: { cuentaGanaderaId }
  };
  if (filters.unidadRegaId) where.unidadRegaId = Number(filters.unidadRegaId);
  if (filters.corralId) where.corralId = Number(filters.corralId);
  if (filters.enfermedadId) where.enfermedadId = Number(filters.enfermedadId);
  if (filters.estado) where.estado = filters.estado;

  const fechaDesde = asDate(filters.fechaDesde);
  const fechaHasta = asDate(filters.fechaHasta, true);
  if (fechaDesde || fechaHasta) {
    where.fechaInicio = {};
    if (fechaDesde) where.fechaInicio.gte = fechaDesde;
    if (fechaHasta) where.fechaInicio.lte = fechaHasta;
  }

  const cases = await prisma.casoSanitario.findMany({
    where,
    include: {
      unidadRega: {
        include: {
          especiePrincipal: true,
          razaPrincipal: true
        }
      },
      animal: {
        include: {
          corralActual: true,
          estadoReproductivo: true,
          especie: true,
          raza: true
        }
      },
      corral: true,
      enfermedad: true
    },
    orderBy: { fechaInicio: 'desc' }
  });

  return cases.map((item) => ({
    id: item.id,
    fecha: formatDate(item.fechaInicio),
    period: periodLabel(item.fechaInicio),
    evento: item.enfermedad?.nombre || item.diagnosticoPresuntivo || 'Evento sanitario',
    estado: item.estado,
    gravedad: item.gravedad,
    crotal: item.animal?.crotal,
    unidadRega: farmUnitLabel(item.unidadRega),
    corral: item.corral?.nombre || item.animal?.corralActual?.nombre,
    estadoReproductivo: item.animal?.estadoReproductivo?.nombre,
    especie: item.animal?.especie?.nombre,
    raza: item.animal?.raza?.nombre,
    sexo: item.animal?.sexo
  }));
}

async function getRows(cuentaGanaderaId, body = {}) {
  const dataset = getDataset(body);
  const filters = body.filters || {};

  if (dataset === 'discharges') return queryDischarges(cuentaGanaderaId, filters);
  if (dataset === 'reproductive') return queryReproductive(cuentaGanaderaId, filters);
  if (dataset === 'health') return queryHealth(cuentaGanaderaId, filters);
  return queryAnimals(cuentaGanaderaId, filters);
}

async function query(cuentaGanaderaId, body = {}) {
  const dataset = getDataset(body);
  const groupBy = body.groupBy || 'corral';
  const rows = await getRows(cuentaGanaderaId, body);
  const grouped = groupRows(rows, groupBy);

  return {
    title: DATASET_LABELS[dataset],
    dataset,
    groupBy,
    total: rows.length,
    summary: grouped,
    rows,
    chart: {
      type: chartTypeFor(grouped, groupBy),
      xField: 'label',
      yField: 'value'
    }
  };
}

function rowsForExcel(result, body = {}) {
  const filters = body.filters || {};
  const summaryRows = [
    ['Dataset', result.title],
    ['Total', result.total],
    ['Agrupación', result.groupBy || 'Total'],
    ['Fecha desde', filters.fechaDesde || ''],
    ['Fecha hasta', filters.fechaHasta || ''],
    [],
    ['Grupo', 'Cantidad', '%'],
    ...result.summary.map((row) => [row.label, row.value, row.percent])
  ];

  const keys = [...new Set(result.rows.flatMap((row) => Object.keys(row)))];
  const dataRows = [
    keys,
    ...result.rows.map((row) => keys.map((key) => row[key] ?? ''))
  ];

  return { summaryRows, dataRows };
}

async function buildExcel(cuentaGanaderaId, body = {}) {
  const result = await query(cuentaGanaderaId, body);
  const { summaryRows, dataRows } = rowsForExcel(result, body);

  return {
    filename: `rumiando_${result.dataset}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    buffer: buildWorkbook({
      title: result.title,
      summaryRows,
      dataRows
    }),
    result
  };
}

function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true'
    && process.env.BREVO_API_KEY
    && process.env.EMAIL_FROM_ADDRESS;
}

async function sendExcelEmail(cuentaGanaderaId, body = {}) {
  const email = String(body.email || body.emailDestino || '').trim().toLowerCase();
  if (!email) {
    throw new AppError('El email destino es obligatorio', 400);
  }

  const { buffer, filename, result } = await buildExcel(cuentaGanaderaId, body.query || body);

  if (!isEmailEnabled()) {
    return {
      sent: false,
      reason: 'EMAIL_NOT_CONFIGURED',
      filename,
      total: result.total
    };
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'RumiAndo',
        email: process.env.EMAIL_FROM_ADDRESS
      },
      to: [{ email }],
      subject: `Exportación de datos - ${result.title}`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;color:#233127">
          <h2>Exportación de datos</h2>
          <p>Adjuntamos el Excel generado desde RumiAndo.</p>
          <p><strong>Contenido:</strong> ${result.title}</p>
          <p><strong>Registros:</strong> ${result.total}</p>
        </div>
      `,
      attachment: [{
        name: filename,
        content: buffer.toString('base64')
      }]
    })
  });

  if (!response.ok) {
    throw new AppError('No se pudo enviar el email de exportación', 502);
  }

  return {
    sent: true,
    filename,
    total: result.total
  };
}

module.exports = {
  getOptions,
  query,
  buildExcel,
  sendExcelEmail
};
