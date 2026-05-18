require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');

function date(value) {
  return new Date(value);
}

function today() {
  const result = new Date();
  result.setHours(12, 0, 0, 0);
  return result;
}

function addDays(baseDate, days) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

function yearsAgo(years, month = 1, day = 15) {
  const now = today();
  return new Date(now.getFullYear() - years, month - 1, day, 12, 0, 0, 0);
}

function pad(value, length = 3) {
  return String(value).padStart(length, '0');
}

async function clearDatabase() {
  await prisma.movimientoAnimalDetalle.deleteMany();
  await prisma.movimientoTransaccion.deleteMany();
  await prisma.eventoReproductivo.deleteMany();
  await prisma.tratamientoVeterinario.deleteMany();
  await prisma.vacunacion.deleteMany();
  await prisma.desparasitacion.deleteMany();
  await prisma.casoSanitario.deleteMany();
  await prisma.recordatorio.deleteMany();
  await prisma.exportacionRegistro.deleteMany();
  await prisma.animal.deleteMany();
  await prisma.corral.deleteMany();
  await prisma.unidadRega.deleteMany();
  await prisma.catalogoEstadoReproductivo.deleteMany();
  await prisma.catalogoEnfermedad.deleteMany();
  await prisma.catalogoRaza.deleteMany();
  await prisma.catalogoEspecie.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cuentaGanadera.deleteMany();
}

async function createCatalogs(cuentaId) {
  const caprino = await prisma.catalogoEspecie.create({
    data: { nombre: 'Caprino', cuentaGanaderaId: cuentaId }
  });

  const ovino = await prisma.catalogoEspecie.create({
    data: { nombre: 'Ovino', cuentaGanaderaId: cuentaId }
  });

  const majorera = await prisma.catalogoRaza.create({
    data: { nombre: 'Majorera', cuentaGanaderaId: cuentaId, especieId: caprino.id }
  });

  const murcianoGranadina = await prisma.catalogoRaza.create({
    data: { nombre: 'Murciano-Granadina', cuentaGanaderaId: cuentaId, especieId: caprino.id }
  });

  const manchega = await prisma.catalogoRaza.create({
    data: { nombre: 'Manchega', cuentaGanaderaId: cuentaId, especieId: ovino.id }
  });

  const canaria = await prisma.catalogoRaza.create({
    data: { nombre: 'Canaria', cuentaGanaderaId: cuentaId, especieId: ovino.id }
  });

  const estadosSeed = [
    ['No aplica', 1],
    ['No reproductor', 2],
    ['Vacía', 3],
    ['Producción', 4],
    ['Cubierta / Inseminada', 5],
    ['Gestante', 6],
    ['Parida', 7],
    ['Abortada', 8],
    ['Problema reproductivo', 9]
  ];

  const estados = {};

  for (const [nombre, orden] of estadosSeed) {
    estados[nombre] = await prisma.catalogoEstadoReproductivo.create({
      data: { nombre, orden, cuentaGanaderaId: cuentaId }
    });
  }

  const enfermedadesSeed = [
    {
      nombre: 'Lengua azul',
      descripcion: 'Enfermedad vírica transmitida por culicoides. Ejemplo de enfermedad de declaración obligatoria.',
      declaracionObligatoria: true,
      requiereLazareto: true
    },
    {
      nombre: 'Brucelosis ovina y caprina',
      descripcion: 'Zoonosis bacteriana incluida como ejemplo de control sanitario oficial.',
      declaracionObligatoria: true,
      requiereLazareto: true
    },
    {
      nombre: 'Agalaxia contagiosa ovina y caprina',
      descripcion: 'Proceso infeccioso relevante en pequeños rumiantes, asociado a mamitis, artritis y queratoconjuntivitis.',
      declaracionObligatoria: false,
      requiereLazareto: true
    },
    {
      nombre: 'Mamitis clínica',
      descripcion: 'Inflamación clínica de la glándula mamaria con alteración de leche y/o estado general.',
      declaracionObligatoria: false,
      requiereLazareto: false
    },
    {
      nombre: 'Pododermatitis / cojeras',
      descripcion: 'Proceso podal frecuente relacionado con manejo, humedad, heridas o infección secundaria.',
      declaracionObligatoria: false,
      requiereLazareto: false
    },
    {
      nombre: 'Coccidiosis',
      descripcion: 'Proceso parasitario digestivo frecuente en recría.',
      declaracionObligatoria: false,
      requiereLazareto: false
    },
    {
      nombre: 'Parasitosis gastrointestinal',
      descripcion: 'Proceso parasitario digestivo de manejo habitual en pequeños rumiantes.',
      declaracionObligatoria: false,
      requiereLazareto: false
    },
    {
      nombre: 'Neumonía',
      descripcion: 'Proceso respiratorio compatible con fiebre, tos, disnea o decaimiento.',
      declaracionObligatoria: false,
      requiereLazareto: true
    }
  ];

  const enfermedades = {};

  for (const enfermedad of enfermedadesSeed) {
    enfermedades[enfermedad.nombre] = await prisma.catalogoEnfermedad.create({
      data: { ...enfermedad, cuentaGanaderaId: cuentaId }
    });
  }

  return {
    species: { caprino, ovino },
    breeds: { majorera, murcianoGranadina, manchega, canaria },
    estados,
    enfermedades
  };
}

async function createFarmUnit({ cuentaId, codigoRega, nombre, municipio, provincia, especiePrincipalId }) {
  return prisma.unidadRega.create({
    data: {
      codigoRega,
      nombre,
      municipio,
      provincia,
      activa: true,
      cuentaGanaderaId: cuentaId,
      especiePrincipalId
    }
  });
}

async function createPens(unidadRegaId, estados) {
  const pensSeed = [
    { nombre: 'Producción', tipoFuncional: 'PRODUCCION', capacidad: 70, estado: 'Producción' },
    { nombre: 'Cubrición', tipoFuncional: 'CUBRICION', capacidad: 35, estado: 'Cubierta / Inseminada' },
    { nombre: 'Gestantes', tipoFuncional: 'GESTACION', capacidad: 45, estado: 'Gestante' },
    { nombre: 'Secado', tipoFuncional: 'SECADO', capacidad: 35, estado: 'Gestante' },
    { nombre: 'Paridera', tipoFuncional: 'PARIDERA', capacidad: 25, estado: 'Parida' },
    { nombre: 'Reposición', tipoFuncional: 'REPOSICION', capacidad: 40, estado: 'No reproductor' },
    { nombre: 'Lazareto', tipoFuncional: 'LAZARETO', capacidad: 8, estado: null },
    { nombre: 'Machos', tipoFuncional: 'MACHOS', capacidad: 6, estado: 'No aplica' }
  ];

  const pens = {};

  for (const pen of pensSeed) {
    pens[pen.nombre] = await prisma.corral.create({
      data: {
        nombre: pen.nombre,
        tipoFuncional: pen.tipoFuncional,
        capacidad: pen.capacidad,
        aplicarEstadoAutomaticamente: ['Cubrición', 'Gestantes', 'Secado', 'Paridera'].includes(pen.nombre),
        unidadRegaId,
        estadoReproductivoSugeridoId: pen.estado ? estados[pen.estado].id : null
      }
    });
  }

  return pens;
}

async function createAnimal({
  crotal,
  numeroInterno,
  sexo,
  fechaNacimiento,
  fechaEntrada,
  origen,
  unidadRega,
  especie,
  raza,
  corral,
  estado,
  fechaEntradaCorralActual,
  fechaEstadoReproductivoActual,
  madreId = null,
  padreId = null,
  observaciones = null
}) {
  return prisma.animal.create({
    data: {
      crotal,
      numeroInterno,
      sexo,
      fechaNacimiento,
      fechaEntrada,
      origen,
      estadoRegistro: 'ACTIVO',
      unidadRegaId: unidadRega.id,
      especieId: especie.id,
      razaId: raza.id,
      corralActualId: corral.id,
      fechaEntradaCorralActual,
      estadoReproductivoId: estado.id,
      fechaEstadoReproductivoActual,
      madreId,
      padreId,
      observaciones
    }
  });
}

async function createBaseHerd({ prefix, internalPrefix, unidadRega, especie, raza, estados, pens, speciesName }) {
  const males = [];
  const adultFemales = [];
  const offspring = [];
  const baseDate = today();

  for (let i = 1; i <= 3; i++) {
    const male = await createAnimal({
      crotal: `${prefix}M${pad(i)}`,
      numeroInterno: `${internalPrefix}-M-${pad(i)}`,
      sexo: 'MACHO',
      fechaNacimiento: yearsAgo(4 + i, i + 1, 10),
      fechaEntrada: date('2022-01-10'),
      origen: 'Compra de reproductor externo',
      unidadRega,
      especie,
      raza,
      corral: pens['Machos'],
      estado: estados['No aplica'],
      fechaEntradaCorralActual: addDays(baseDate, -500),
      fechaEstadoReproductivoActual: addDays(baseDate, -500),
      observaciones: `Macho reproductor ${speciesName} ${raza.nombre}.`
    });

    males.push(male);
  }

  const plannedFemales = [
    { state: 'Producción', pen: 'Producción', days: 40 },
    { state: 'Producción', pen: 'Producción', days: 85 },
    { state: 'Vacía', pen: 'Producción', days: 25 },
    { state: 'Gestante', pen: 'Gestantes', days: 90 },
    { state: 'Gestante', pen: 'Secado', days: 130 },
    { state: 'Parida', pen: 'Paridera', days: 20 },
    { state: 'Cubierta / Inseminada', pen: 'Cubrición', days: 18 },
    { state: 'Cubierta / Inseminada', pen: 'Cubrición', days: 30 },
    { state: 'Vacía', pen: 'Producción', days: 75 },
    { state: 'Producción', pen: 'Producción', days: 100 },
    { state: 'Gestante', pen: 'Gestantes', days: 150 },
    { state: 'Parida', pen: 'Paridera', days: 35 }
  ];

  for (let i = 1; i <= plannedFemales.length; i++) {
    const config = plannedFemales[i - 1];
    const statusDate = addDays(baseDate, -config.days);

    const female = await createAnimal({
      crotal: `${prefix}H${pad(i)}`,
      numeroInterno: `${internalPrefix}-H-${pad(i)}`,
      sexo: 'HEMBRA',
      fechaNacimiento: yearsAgo(3 + (i % 4), (i % 12) + 1, 15),
      fechaEntrada: date('2023-01-15'),
      origen: i <= 8 ? 'Nacimiento en explotación' : 'Compra de lote reproductor',
      unidadRega,
      especie,
      raza,
      corral: pens[config.pen],
      estado: estados[config.state],
      fechaEntradaCorralActual: statusDate,
      fechaEstadoReproductivoActual: statusDate,
      observaciones: `Hembra adulta ${speciesName} ${raza.nombre}.`
    });

    adultFemales.push(female);
  }

  for (let i = 1; i <= 8; i++) {
    const mother = adultFemales[(i - 1) % adultFemales.length];
    const father = males[(i - 1) % males.length];
    const birthDate = addDays(baseDate, -(40 + i * 12));

    const child = await createAnimal({
      crotal: `${prefix}C${pad(i)}`,
      numeroInterno: `${internalPrefix}-C-${pad(i)}`,
      sexo: i % 5 === 0 ? 'MACHO' : 'HEMBRA',
      fechaNacimiento: birthDate,
      fechaEntrada: birthDate,
      origen: 'Nacimiento en explotación',
      unidadRega,
      especie,
      raza,
      corral: pens['Reposición'],
      estado: estados['No reproductor'],
      fechaEntradaCorralActual: birthDate,
      fechaEstadoReproductivoActual: birthDate,
      madreId: mother.id,
      padreId: father.id,
      observaciones: 'Animal joven de reposición con genealogía básica registrada.'
    });

    offspring.push(child);
  }

  return { males, adultFemales, offspring, all: [...males, ...adultFemales, ...offspring] };
}

async function createGeneralRecordsForFarmUnit({ unidadRega, pens, animals, estados, enfermedades, admin, origenRegla }) {
  const baseDate = today();

  const father = animals.males[0];
  const productionFemale = animals.adultFemales[0];
  const pregnantFemale = animals.adultFemales[3];
  const postpartumFemale = animals.adultFemales[5];
  const emptyFemale = animals.adultFemales[8];
  const sickFemale = animals.adultFemales[9];
  const lameFemale = animals.adultFemales[10];
  const youngAnimal = animals.offspring[1];

  await prisma.eventoReproductivo.createMany({
    data: [
      {
        animalId: productionFemale.id,
        tipoEvento: 'CUBRICION',
        resultado: 'NO_APLICA',
        fecha: addDays(baseDate, -120),
        estadoResultanteId: estados['Cubierta / Inseminada'].id,
        observaciones: `Cubrición natural con macho ${father.crotal}.`
      },
      {
        animalId: productionFemale.id,
        tipoEvento: 'DIAGNOSTICO_GESTACION',
        resultado: 'NEGATIVO',
        fecha: addDays(baseDate, -80),
        semanasGestacion: null,
        fechaPartoEstimada: null,
        estadoResultanteId: estados['Vacía'].id,
        observaciones: 'Diagnóstico negativo registrado en revisión reproductiva.'
      },
      {
        animalId: pregnantFemale.id,
        tipoEvento: 'CUBRICION',
        resultado: 'NO_APLICA',
        fecha: addDays(baseDate, -130),
        estadoResultanteId: estados['Cubierta / Inseminada'].id,
        observaciones: `Cubrición natural con macho ${father.crotal}.`
      },
      {
        animalId: pregnantFemale.id,
        tipoEvento: 'DIAGNOSTICO_GESTACION',
        resultado: 'POSITIVO',
        fecha: addDays(baseDate, -95),
        semanasGestacion: 6,
        fechaPartoEstimada: addDays(baseDate, 45),
        estadoResultanteId: estados['Gestante'].id,
        observaciones: 'Diagnóstico positivo dentro del manejo reproductivo normal.'
      },
      {
        animalId: postpartumFemale.id,
        tipoEvento: 'PARTO',
        resultado: 'NO_APLICA',
        fecha: addDays(baseDate, -22),
        numeroCriasVivas: 2,
        numeroCriasMuertas: 0,
        estadoResultanteId: estados['Parida'].id,
        observaciones: 'Parto doble sin incidencias graves.'
      },
      {
        animalId: emptyFemale.id,
        tipoEvento: 'REVISION_REPRODUCTIVA',
        resultado: 'NO_APLICA',
        fecha: addDays(baseDate, -15),
        estadoResultanteId: estados['Vacía'].id,
        observaciones: 'Revisión reproductiva ordinaria.'
      }
    ]
  });

  const mastitisCase = await prisma.casoSanitario.create({
    data: {
      fechaInicio: addDays(baseDate, -12),
      signosClinicos: 'Ubre caliente, leche alterada y ligera disminución de producción.',
      diagnosticoPresuntivo: 'Mamitis clínica leve-moderada.',
      diagnosticoConfirmado: 'Mamitis clínica',
      gravedad: 'Moderada',
      afectaBienestar: true,
      lazareto: false,
      avisoDeclaracionMostrado: false,
      estado: 'ABIERTO',
      unidadRegaId: unidadRega.id,
      animalId: sickFemale.id,
      corralId: pens['Producción'].id,
      enfermedadId: enfermedades['Mamitis clínica'].id
    }
  });

  await prisma.tratamientoVeterinario.create({
    data: {
      fechaInicio: addDays(baseDate, -12),
      fechaFin: addDays(baseDate, -8),
      motivo: 'Tratamiento asociado a mamitis clínica.',
      medicamentoProducto: 'Antibiótico intramamario de secado / equivalente',
      principioActivo: 'Cloxacilina benzatina',
      dosisTexto: 'Según ficha técnica y prescripción veterinaria',
      unidad: 'jeringa intramamaria',
      via: 'Intramamaria',
      frecuencia: 'Según pauta veterinaria',
      duracionDias: 4,
      retirada: 'Respetar periodo de retirada indicado por ficha técnica',
      casoSanitarioId: mastitisCase.id,
      animalId: sickFemale.id,
      corralId: pens['Producción'].id
    }
  });

  await prisma.tratamientoVeterinario.create({
    data: {
      fechaInicio: addDays(baseDate, -12),
      fechaFin: addDays(baseDate, -10),
      motivo: 'Antiinflamatorio de soporte para mamitis clínica.',
      medicamentoProducto: 'Metacam 20 mg/ml solución inyectable',
      principioActivo: 'Meloxicam',
      dosisTexto: 'Según peso vivo y prescripción veterinaria',
      unidad: 'ml',
      via: 'SC',
      frecuencia: 'Según pauta veterinaria',
      duracionDias: 2,
      retirada: 'Consultar ficha técnica antes de destino a leche/carne',
      casoSanitarioId: mastitisCase.id,
      animalId: sickFemale.id,
      corralId: pens['Producción'].id
    }
  });

  const footCase = await prisma.casoSanitario.create({
    data: {
      fechaInicio: addDays(baseDate, -6),
      signosClinicos: 'Cojera de apoyo, lesión interdigital y sensibilidad a la exploración.',
      diagnosticoPresuntivo: 'Pododermatitis.',
      diagnosticoConfirmado: null,
      gravedad: 'Leve',
      afectaBienestar: true,
      lazareto: false,
      avisoDeclaracionMostrado: false,
      estado: 'ABIERTO',
      unidadRegaId: unidadRega.id,
      animalId: lameFemale.id,
      corralId: pens['Gestantes'].id,
      enfermedadId: enfermedades['Pododermatitis / cojeras'].id
    }
  });

  await prisma.tratamientoVeterinario.create({
    data: {
      fechaInicio: addDays(baseDate, -6),
      fechaFin: null,
      motivo: 'Cojera compatible con pododermatitis.',
      medicamentoProducto: 'Oxitetraciclina LA 300 mg/ml equivalente',
      principioActivo: 'Oxitetraciclina',
      dosisTexto: 'Según peso vivo y prescripción veterinaria',
      unidad: 'ml',
      via: 'IM',
      frecuencia: 'Según pauta veterinaria',
      duracionDias: 3,
      retirada: 'Respetar periodo de retirada indicado por ficha técnica',
      casoSanitarioId: footCase.id,
      animalId: lameFemale.id,
      corralId: pens['Gestantes'].id
    }
  });

  await prisma.vacunacion.create({
    data: {
      fecha: addDays(baseDate, -35),
      vacuna: 'Vacuna clostridial polivalente equivalente',
      loteVacuna: `${origenRegla}-CLOST-2026-01`,
      dosisTexto: 'Según ficha técnica',
      via: 'SC',
      revacunacionPrevista: true,
      fechaRevacunacion: addDays(baseDate, 330),
      reaccion: false,
      documentoUrl: null,
      unidadRegaId: unidadRega.id,
      corralId: pens['Producción'].id
    }
  });

  await prisma.vacunacion.create({
    data: {
      fecha: addDays(baseDate, -70),
      vacuna: 'Vacuna frente a lengua azul equivalente',
      loteVacuna: `${origenRegla}-BTV-2026-01`,
      dosisTexto: 'Según ficha técnica',
      via: 'SC',
      revacunacionPrevista: true,
      fechaRevacunacion: addDays(baseDate, 295),
      reaccion: false,
      documentoUrl: null,
      unidadRegaId: unidadRega.id,
      corralId: pens['Gestantes'].id
    }
  });

  await prisma.desparasitacion.create({
    data: {
      fecha: addDays(baseDate, -80),
      tipo: 'Interna',
      producto: 'Moxidectina oral equivalente',
      principioActivo: 'Moxidectina',
      dosisTexto: 'Según peso vivo y ficha técnica',
      via: 'Oral',
      motivo: 'Control estratégico de parasitosis gastrointestinal.',
      proximaDosisPrevista: true,
      fechaProximaDosis: addDays(baseDate, 100),
      reaccion: false,
      documentoUrl: null,
      unidadRegaId: unidadRega.id,
      corralId: pens['Producción'].id
    }
  });

  await prisma.desparasitacion.create({
    data: {
      fecha: addDays(baseDate, -20),
      tipo: 'Coccidiosis',
      producto: 'Toltrazurilo oral equivalente',
      principioActivo: 'Toltrazurilo',
      dosisTexto: 'Según peso vivo y ficha técnica',
      via: 'Oral',
      motivo: 'Control de coccidiosis en reposición.',
      proximaDosisPrevista: false,
      fechaProximaDosis: null,
      reaccion: false,
      documentoUrl: null,
      unidadRegaId: unidadRega.id,
      animalId: youngAnimal.id,
      corralId: pens['Reposición'].id
    }
  });

  const movementDate = addDays(baseDate, -28);

  const movement = await prisma.movimientoTransaccion.create({
    data: {
      tipoOperacion: 'LOTE',
      motivo: 'Paso de animales de reposición a producción tras revisión de manejo.',
      fecha: movementDate,
      resumen: {
        totalLeidos: 4,
        procesados: 3,
        noEncontrados: 1,
        yaEnDestino: 0
      },
      unidadRegaId: unidadRega.id,
      corralOrigenId: pens['Reposición'].id,
      corralDestinoId: pens['Producción'].id,
      userId: admin.id
    }
  });

  const movedAnimals = animals.offspring.slice(2, 5);

  for (const animal of movedAnimals) {
    await prisma.movimientoAnimalDetalle.create({
      data: {
        transaccionId: movement.id,
        animalId: animal.id,
        crotalLeido: animal.crotal,
        estadoProceso: 'PROCESADO',
        corralOrigenId: pens['Reposición'].id,
        corralDestinoId: pens['Producción'].id,
        observaciones: 'Movimiento de reposición a producción registrado en seed.'
      }
    });

    await prisma.animal.update({
      where: { id: animal.id },
      data: {
        corralActualId: pens['Producción'].id,
        fechaEntradaCorralActual: movementDate,
        estadoReproductivoId: estados['Producción'].id,
        fechaEstadoReproductivoActual: movementDate
      }
    });
  }

  await prisma.movimientoAnimalDetalle.create({
    data: {
      transaccionId: movement.id,
      crotalLeido: `${unidadRega.codigoRega}-SIN-LECTURA`,
      estadoProceso: 'NO_ENCONTRADO',
      corralDestinoId: pens['Producción'].id,
      observaciones: 'Lectura de crotal no encontrado durante movimiento demo.'
    }
  });

  await prisma.exportacionRegistro.create({
    data: {
      tipoExportacion: 'CENSO',
      fechaDesde: addDays(baseDate, -365),
      fechaHasta: baseDate,
      emailDestino: 'admin@rumiando.com',
      estadoEnvio: 'PENDIENTE',
      urlExcel: null,
      urlPdf: null,
      respuestaN8n: {
        demo: true,
        message: 'Registro preparado para exportación demo.'
      },
      cuentaGanaderaId: unidadRega.cuentaGanaderaId,
      unidadRegaId: unidadRega.id
    }
  });
}

async function createAutomaticAlertAnimals({ unidadRega, pens, especie, raza, estados, enfermedades, prefix, internalPrefix }) {
  const baseDate = today();

  async function alertFemale(index, stateName, penName, daysInState, text) {
    const stateDate = addDays(baseDate, -daysInState);

    return createAnimal({
      crotal: `${prefix}${pad(index)}`,
      numeroInterno: `${internalPrefix}-${pad(index)}`,
      sexo: 'HEMBRA',
      fechaNacimiento: yearsAgo(4, ((index - 1) % 12) + 1, 12),
      fechaEntrada: addDays(baseDate, -700),
      origen: 'Animal demo creado para comprobar avisos automáticos',
      unidadRega,
      especie,
      raza,
      corral: pens[penName],
      estado: estados[stateName],
      fechaEntradaCorralActual: stateDate,
      fechaEstadoReproductivoActual: stateDate,
      observaciones: text
    });
  }

  const productionA = await alertFemale(
    1,
    'Producción',
    'Producción',
    180,
    'Demo automática: recomendable cubrir tras 5 meses en producción.'
  );

  const productionB = await alertFemale(
    2,
    'Producción',
    'Producción',
    195,
    'Demo automática: recomendable cubrir tras 5 meses en producción.'
  );

  const breedingA = await alertFemale(
    3,
    'Cubierta / Inseminada',
    'Cubrición',
    60,
    'Demo automática: diagnóstico de gestación pendiente tras cubrición.'
  );

  await prisma.eventoReproductivo.create({
    data: {
      animalId: breedingA.id,
      tipoEvento: 'CUBRICION',
      resultado: 'NO_APLICA',
      fecha: addDays(baseDate, -60),
      estadoResultanteId: estados['Cubierta / Inseminada'].id,
      observaciones: 'Cubrición registrada sin diagnóstico posterior para disparar aviso automático.'
    }
  });

    const breedingB = await alertFemale(
    4,
    'Cubierta / Inseminada',
    'Cubrición',
    68,
    'Demo automática: diagnóstico de gestación pendiente tras inseminación.'
  );

  await prisma.eventoReproductivo.create({
    data: {
      animalId: breedingB.id,
      tipoEvento: 'INSEMINACION',
      resultado: 'NO_APLICA',
      fecha: addDays(baseDate, -68),
      estadoResultanteId: estados['Cubierta / Inseminada'].id,
      observaciones: 'Inseminación registrada sin diagnóstico posterior para disparar aviso automático.'
    }
  });

  const pregnantA = await alertFemale(
    5,
    'Gestante',
    'Gestantes',
    225,
    'Demo automática: valorar paso a seca tras 7 meses gestante.'
  );

  await prisma.eventoReproductivo.create({
    data: {
      animalId: pregnantA.id,
      tipoEvento: 'DIAGNOSTICO_GESTACION',
      resultado: 'POSITIVO',
      fecha: addDays(baseDate, -225),
      semanasGestacion: 6,
      fechaPartoEstimada: addDays(baseDate, 20),
      estadoResultanteId: estados['Gestante'].id,
      observaciones: 'Diagnóstico positivo antiguo para disparar aviso de seca.'
    }
  });

  const pregnantB = await alertFemale(
    6,
    'Gestante',
    'Gestantes',
    240,
    'Demo automática: valorar paso a seca tras 7 meses gestante.'
  );

  await prisma.eventoReproductivo.create({
    data: {
      animalId: pregnantB.id,
      tipoEvento: 'DIAGNOSTICO_GESTACION',
      resultado: 'POSITIVO',
      fecha: addDays(baseDate, -240),
      semanasGestacion: 7,
      fechaPartoEstimada: addDays(baseDate, 12),
      estadoResultanteId: estados['Gestante'].id,
      observaciones: 'Diagnóstico positivo antiguo para disparar aviso de seca.'
    }
  });

  const noBirthA = await alertFemale(
    7,
    'Vacía',
    'Producción',
    90,
    'Demo automática: más de un año desde el último parto registrado.'
  );

  await prisma.eventoReproductivo.create({
    data: {
      animalId: noBirthA.id,
      tipoEvento: 'PARTO',
      resultado: 'NO_APLICA',
      fecha: addDays(baseDate, -390),
      numeroCriasVivas: 1,
      numeroCriasMuertas: 0,
      estadoResultanteId: estados['Parida'].id,
      observaciones: 'Último parto registrado hace más de un año.'
    }
  });

  const noBirthB = await alertFemale(
    8,
    'Vacía',
    'Producción',
    115,
    'Demo automática: más de un año desde el último parto registrado.'
  );

  await prisma.eventoReproductivo.create({
    data: {
      animalId: noBirthB.id,
      tipoEvento: 'PARTO',
      resultado: 'NO_APLICA',
      fecha: addDays(baseDate, -430),
      numeroCriasVivas: 2,
      numeroCriasMuertas: 0,
      estadoResultanteId: estados['Parida'].id,
      observaciones: 'Último parto registrado hace más de un año.'
    }
  });

  const mandatoryA = await alertFemale(
    9,
    'Vacía',
    'Lazareto',
    8,
    'Demo automática: caso sanitario abierto con enfermedad de declaración obligatoria.'
  );

  await prisma.casoSanitario.create({
    data: {
      fechaInicio: addDays(baseDate, -5),
      signosClinicos: 'Fiebre, decaimiento y ligera congestión de mucosas.',
      diagnosticoPresuntivo: 'Sospecha de lengua azul.',
      diagnosticoConfirmado: null,
      gravedad: 'Alta',
      afectaBienestar: true,
      lazareto: true,
      avisoDeclaracionMostrado: true,
      estado: 'ABIERTO',
      unidadRegaId: unidadRega.id,
      animalId: mandatoryA.id,
      corralId: pens['Lazareto'].id,
      enfermedadId: enfermedades['Lengua azul'].id
    }
  });

  const mandatoryB = await alertFemale(
    10,
    'Vacía',
    'Lazareto',
    6,
    'Demo automática: caso sanitario abierto con enfermedad de declaración obligatoria.'
  );

  await prisma.casoSanitario.create({
    data: {
      fechaInicio: addDays(baseDate, -3),
      signosClinicos: 'Abortos repetidos y decaimiento en animal adulto.',
      diagnosticoPresuntivo: 'Sospecha de brucelosis ovina/caprina.',
      diagnosticoConfirmado: null,
      gravedad: 'Alta',
      afectaBienestar: true,
      lazareto: true,
      avisoDeclaracionMostrado: true,
      estado: 'ABIERTO',
      unidadRegaId: unidadRega.id,
      animalId: mandatoryB.id,
      corralId: pens['Lazareto'].id,
      enfermedadId: enfermedades['Brucelosis ovina y caprina'].id
    }
  });

  await prisma.eventoReproductivo.create({
    data: {
      animalId: productionA.id,
      tipoEvento: 'REVISION_REPRODUCTIVA',
      resultado: 'NO_APLICA',
      fecha: addDays(baseDate, -180),
      estadoResultanteId: estados['Producción'].id,
      observaciones: 'Entrada en estado producción para demo de aviso automático.'
    }
  });

  await prisma.eventoReproductivo.create({
    data: {
      animalId: productionB.id,
      tipoEvento: 'REVISION_REPRODUCTIVA',
      resultado: 'NO_APLICA',
      fecha: addDays(baseDate, -195),
      estadoResultanteId: estados['Producción'].id,
      observaciones: 'Entrada en estado producción para demo de aviso automático.'
    }
  });
}

async function main() {
  console.log('Reiniciando seed realista de RumiAndo v2...');

  await clearDatabase();

  const cuenta = await prisma.cuentaGanadera.create({
    data: {
      nombre: 'Ganadería Demo RumiAndo',
      titularNombre: 'Titular Demo RumiAndo',
      nifCif: '00000000T',
      telefono: '600000000',
      emailContacto: 'admin@rumiando.com',
      direccion: 'Carretera general s/n, Canarias'
    }
  });

  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: {
      nombre: 'Admin Demo',
      email: 'admin@rumiando.com',
      passwordHash,
      rol: 'ADMIN',
      cuentaGanaderaId: cuenta.id
    }
  });

  await prisma.user.create({
    data: {
      nombre: 'Operario Demo',
      email: 'operario@rumiando.com',
      passwordHash,
      rol: 'OPERARIO',
      cuentaGanaderaId: cuenta.id
    }
  });

  const { species, breeds, estados, enfermedades } = await createCatalogs(cuenta.id);

  const regaCaprino = await createFarmUnit({
    cuentaId: cuenta.id,
    codigoRega: 'ES350000000001',
    nombre: 'REGA caprino Majorero',
    municipio: 'Teguise',
    provincia: 'Las Palmas',
    especiePrincipalId: species.caprino.id
  });

  const regaOvino = await createFarmUnit({
    cuentaId: cuenta.id,
    codigoRega: 'ES350000000002',
    nombre: 'REGA ovino Manchego',
    municipio: 'San Bartolomé',
    provincia: 'Las Palmas',
    especiePrincipalId: species.ovino.id
  });

  const pensCaprino = await createPens(regaCaprino.id, estados);
  const pensOvino = await createPens(regaOvino.id, estados);

  const caprinoAnimals = await createBaseHerd({
    prefix: 'ESCAPMAJ',
    internalPrefix: 'CAP-MAJ',
    unidadRega: regaCaprino,
    especie: species.caprino,
    raza: breeds.majorera,
    estados,
    pens: pensCaprino,
    speciesName: 'caprino'
  });

  const ovinoAnimals = await createBaseHerd({
    prefix: 'ESOVMAN',
    internalPrefix: 'OV-MAN',
    unidadRega: regaOvino,
    especie: species.ovino,
    raza: breeds.manchega,
    estados,
    pens: pensOvino,
    speciesName: 'ovino'
  });

  await createGeneralRecordsForFarmUnit({
    unidadRega: regaCaprino,
    pens: pensCaprino,
    animals: caprinoAnimals,
    estados,
    enfermedades,
    admin,
    origenRegla: 'CAPRINO'
  });

  await createGeneralRecordsForFarmUnit({
    unidadRega: regaOvino,
    pens: pensOvino,
    animals: ovinoAnimals,
    estados,
    enfermedades,
    admin,
    origenRegla: 'OVINO'
  });

  await createAutomaticAlertAnimals({
    unidadRega: regaCaprino,
    pens: pensCaprino,
    especie: species.caprino,
    raza: breeds.majorera,
    estados,
    enfermedades,
    prefix: 'DEMOAUTO',
    internalPrefix: 'AUTO'
  });

  console.log('Seed completado.');
  console.log(`Cuenta demo id -> ${cuenta.id}`);
  console.log(`Unidad caprina id -> ${regaCaprino.id}`);
  console.log(`Unidad ovina id -> ${regaOvino.id}`);
  console.log('Usuarios demo:');
  console.log('ADMIN -> admin@rumiando.com / 123456');
  console.log('OPERARIO -> operario@rumiando.com / 123456');
  console.log('Datos creados: 2 REGA, especies, razas, estados, corrales, animales, reproducción, sanidad, tratamientos, vacunaciones, desparasitaciones, movimientos, exportaciones y avisos automáticos demostrables.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  