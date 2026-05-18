require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');

function fecha(valor) {
  return new Date(valor);
}

async function crearEventoReproductivo({ animalId, tipoEvento, resultado, fechaEvento, estadoResultanteId, semanasGestacion, fechaPartoEstimada, numeroCriasVivas, numeroCriasMuertas, observaciones }) {
  return prisma.eventoReproductivo.create({
    data: {
      animalId,
      tipoEvento,
      resultado,
      fecha: fecha(fechaEvento),
      estadoResultanteId: estadoResultanteId || null,
      semanasGestacion: semanasGestacion || null,
      fechaPartoEstimada: fechaPartoEstimada ? fecha(fechaPartoEstimada) : null,
      numeroCriasVivas: numeroCriasVivas ?? null,
      numeroCriasMuertas: numeroCriasMuertas ?? null,
      observaciones: observaciones || null
    }
  });
}

async function main() {
  console.log('Iniciando seed ampliado de RumiAndo v2...');

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
  await prisma.catalogoEstadoReproductivo.deleteMany();
  await prisma.catalogoEnfermedad.deleteMany();
  await prisma.catalogoRaza.deleteMany();
  await prisma.catalogoEspecie.deleteMany();
  await prisma.user.deleteMany();
  await prisma.unidadRega.deleteMany();
  await prisma.cuentaGanadera.deleteMany();

  const cuenta = await prisma.cuentaGanadera.create({
    data: {
      nombre: 'Finca Demo RumiAndo',
      titularNombre: 'Titular Demo',
      nifCif: '00000000T',
      telefono: '600000000',
      emailContacto: 'demo@rumiando.com',
      direccion: 'Las Palmas de Gran Canaria'
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

  const ovino = await prisma.catalogoEspecie.create({
    data: {
      nombre: 'Ovino',
      cuentaGanaderaId: cuenta.id
    }
  });

  const caprino = await prisma.catalogoEspecie.create({
    data: {
      nombre: 'Caprino',
      cuentaGanaderaId: cuenta.id
    }
  });

  const razaMerina = await prisma.catalogoRaza.create({
    data: {
      nombre: 'Merina',
      cuentaGanaderaId: cuenta.id,
      especieId: ovino.id
    }
  });

  const razaManchega = await prisma.catalogoRaza.create({
    data: {
      nombre: 'Manchega',
      cuentaGanaderaId: cuenta.id,
      especieId: ovino.id
    }
  });

  const razaCanaria = await prisma.catalogoRaza.create({
    data: {
      nombre: 'Canaria',
      cuentaGanaderaId: cuenta.id,
      especieId: ovino.id
    }
  });

  await prisma.catalogoRaza.create({
    data: {
      nombre: 'Majorera',
      cuentaGanaderaId: cuenta.id,
      especieId: caprino.id
    }
  });

  const estados = {};
  const estadosSeed = [
    { nombre: 'No aplica', orden: 1 },
    { nombre: 'No reproductor', orden: 2 },
    { nombre: 'Vacía', orden: 3 },
    { nombre: 'Cubierta / Inseminada', orden: 4 },
    { nombre: 'Gestante', orden: 5 },
    { nombre: 'Parida', orden: 6 },
    { nombre: 'Abortada', orden: 7 },
    { nombre: 'Problema reproductivo', orden: 8 }
  ];

  for (const estado of estadosSeed) {
    const creado = await prisma.catalogoEstadoReproductivo.create({
      data: {
        ...estado,
        cuentaGanaderaId: cuenta.id
      }
    });

    estados[estado.nombre] = creado;
  }

  const unidadRega = await prisma.unidadRega.create({
    data: {
      codigoRega: 'ES350000000001',
      nombre: 'REGA ovino demo',
      municipio: 'Las Palmas de Gran Canaria',
      provincia: 'Las Palmas',
      cuentaGanaderaId: cuenta.id,
      especiePrincipalId: ovino.id
    }
  });

  const pens = {};
  const pensSeed = [
    { nombre: 'Cría', tipoFuncional: 'CRIA', estado: 'No aplica', capacidad: 80 },
    { nombre: 'Producción', tipoFuncional: 'PRODUCCION', estado: 'Vacía', capacidad: 120 },
    { nombre: 'Secado', tipoFuncional: 'SECADO', estado: 'Gestante', capacidad: 60 },
    { nombre: 'Reposición', tipoFuncional: 'REPOSICION', estado: 'No aplica', capacidad: 70 },
    { nombre: 'Cebo', tipoFuncional: 'CEBO', estado: 'No aplica', capacidad: 100 },
    { nombre: 'Vacío', tipoFuncional: 'VACIO', estado: 'Vacía', capacidad: 80 },
    { nombre: 'Paridera', tipoFuncional: 'PARIDERA', estado: 'Parida', capacidad: 40 },
    { nombre: 'Lazareto', tipoFuncional: 'LAZARETO', estado: null, capacidad: 15 },
    { nombre: 'Machos', tipoFuncional: 'MACHOS', estado: 'No aplica', capacidad: 20 }
  ];

  for (const pen of corralesSeed) {
    const creado = await prisma.corral.create({
      data: {
        nombre: corral.nombre,
        tipoFuncional: corral.tipoFuncional,
        capacidad: corral.capacidad,
        aplicarEstadoAutomaticamente: false,
        unidadRegaId: unidadRega.id,
        estadoReproductivoSugeridoId: corral.estado ? estados[corral.estado].id : null
      }
    });

    corrales[corral.nombre] = creado;
  }

  const enfermedadesSeed = [
    'Agalaxia contagiosa ovina y caprina',
    'Brucelosis ovina y caprina',
    'Epididimitis ovina',
    'Estomatitis vesicular',
    'Fiebre aftosa',
    'Fiebre del Valle del Rift',
    'Lengua azul',
    'Peste de los pequeños rumiantes',
    'Pleuropneumonía contagiosa caprina',
    'Scrapie o tembladera',
    'Viruela ovina y caprina'
  ];

  const enfermedades = {};

  for (const enfermedad of enfermedadesSeed) {
    const creada = await prisma.catalogoEnfermedad.create({
      data: {
        nombre: enfermedad,
        descripcion: 'Enfermedad incluida en el catálogo inicial EDO para ovino/caprino.',
        declaracionObligatoria: true,
        requiereLazareto: false,
        cuentaGanaderaId: cuenta.id
      }
    });

    enfermedades[enfermedad] = creada;
  }

  const padre1 = await prisma.animal.create({
    data: {
      crotal: 'ESOV000000001',
      numeroInterno: 'MACHO-001',
      sexo: 'MACHO',
      fechaNacimiento: fecha('2020-01-15'),
      fechaEntrada: fecha('2021-01-10'),
      origen: 'Compra',
      unidadRegaId: unidadRega.id,
      especieId: ovino.id,
      razaId: razaMerina.id,
      corralActualId: corrales['Machos'].id,
      estadoReproductivoId: estados['No aplica'].id,
      observaciones: 'Macho reproductor principal.'
    }
  });

  const padre2 = await prisma.animal.create({
    data: {
      crotal: 'ESOV000000002',
      numeroInterno: 'MACHO-002',
      sexo: 'MACHO',
      fechaNacimiento: fecha('2021-03-20'),
      fechaEntrada: fecha('2022-01-12'),
      origen: 'Compra',
      unidadRegaId: unidadRega.id,
      especieId: ovino.id,
      razaId: razaManchega.id,
      corralActualId: corrales['Machos'].id,
      estadoReproductivoId: estados['No aplica'].id,
      observaciones: 'Segundo macho reproductor.'
    }
  });

  const madresData = [
    ['ESOV000000101', 'H-101', razaMerina.id, '2019-02-10', 'Gestante', 'Secado'],
    ['ESOV000000102', 'H-102', razaMerina.id, '2019-05-12', 'Parida', 'Paridera'],
    ['ESOV000000103', 'H-103', razaManchega.id, '2020-01-22', 'Vacía', 'Vacío'],
    ['ESOV000000104', 'H-104', razaCanaria.id, '2020-06-02', 'Gestante', 'Producción'],
    ['ESOV000000105', 'H-105', razaMerina.id, '2021-02-18', 'Cubierta / Inseminada', 'Producción'],
    ['ESOV000000106', 'H-106', razaManchega.id, '2021-07-14', 'Parida', 'Paridera'],
    ['ESOV000000107', 'H-107', razaCanaria.id, '2022-03-11', 'Vacía', 'Vacío'],
    ['ESOV000000108', 'H-108', razaMerina.id, '2022-09-25', 'Gestante', 'Secado']
  ];

  const madres = [];

  for (const madre of madresData) {
    const [crotal, numeroInterno, razaId, fechaNacimiento, estado, corral] = madre;

    const creada = await prisma.animal.create({
      data: {
        crotal,
        numeroInterno,
        sexo: 'HEMBRA',
        fechaNacimiento: fecha(fechaNacimiento),
        fechaEntrada: fecha(fechaNacimiento),
        origen: 'Nacimiento en explotación',
        unidadRegaId: unidadRega.id,
        especieId: ovino.id,
        razaId,
        corralActualId: corrales[corral].id,
        estadoReproductivoId: estados[estado].id,
        observaciones: `Hembra reproductora demo ${numeroInterno}.`
      }
    });

    madres.push(creada);
  }

  const criasData = [
    ['ESOV000000201', 'CRIA-201', 'HEMBRA', '2025-01-10', madres[1].id, padre1.id, razaMerina.id, 'Reposición'],
    ['ESOV000000202', 'CRIA-202', 'MACHO', '2025-01-10', madres[1].id, padre1.id, razaMerina.id, 'Cebo'],
    ['ESOV000000203', 'CRIA-203', 'HEMBRA', '2025-02-03', madres[5].id, padre2.id, razaManchega.id, 'Reposición'],
    ['ESOV000000204', 'CRIA-204', 'HEMBRA', '2025-02-03', madres[5].id, padre2.id, razaManchega.id, 'Reposición'],
    ['ESOV000000205', 'CRIA-205', 'MACHO', '2025-03-17', madres[0].id, padre1.id, razaMerina.id, 'Cebo'],
    ['ESOV000000206', 'CRIA-206', 'HEMBRA', '2025-03-17', madres[0].id, padre1.id, razaMerina.id, 'Reposición'],
    ['ESOV000000207', 'CRIA-207', 'MACHO', '2025-04-22', madres[3].id, padre2.id, razaCanaria.id, 'Cebo'],
    ['ESOV000000208', 'CRIA-208', 'HEMBRA', '2025-04-22', madres[3].id, padre2.id, razaCanaria.id, 'Reposición'],
    ['ESOV000000209', 'CRIA-209', 'HEMBRA', '2025-06-05', madres[7].id, padre1.id, razaMerina.id, 'Cría'],
    ['ESOV000000210', 'CRIA-210', 'MACHO', '2025-06-05', madres[7].id, padre1.id, razaMerina.id, 'Cría']
  ];

  const crias = [];

  for (const cria of criasData) {
    const [crotal, numeroInterno, sexo, fechaNacimiento, madreId, padreId, razaId, corral] = cria;

    const creada = await prisma.animal.create({
      data: {
        crotal,
        numeroInterno,
        sexo,
        fechaNacimiento: fecha(fechaNacimiento),
        fechaEntrada: fecha(fechaNacimiento),
        origen: 'Nacimiento en explotación',
        unidadRegaId: unidadRega.id,
        especieId: ovino.id,
        razaId,
        corralActualId: corrales[corral].id,
        estadoReproductivoId: estados['No aplica'].id,
        madreId,
        padreId,
        observaciones: `Cría demo con madre y padre registrados.`
      }
    });

    crias.push(creada);
  }

  await crearEventoReproductivo({
    animalId: madres[0].id,
    tipoEvento: 'CUBRICION',
    resultado: 'NO_APLICA',
    fechaEvento: '2024-08-01',
    estadoResultanteId: estados['Cubierta / Inseminada'].id,
    observaciones: 'Cubrición natural.'
  });

  await crearEventoReproductivo({
    animalId: madres[0].id,
    tipoEvento: 'DIAGNOSTICO_GESTACION',
    resultado: 'POSITIVO',
    fechaEvento: '2024-09-15',
    semanasGestacion: 6,
    estadoResultanteId: estados['Gestante'].id,
    observaciones: 'Diagnóstico positivo.'
  });

  await crearEventoReproductivo({
    animalId: madres[0].id,
    tipoEvento: 'PARTO',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-03-17',
    numeroCriasVivas: 2,
    numeroCriasMuertas: 0,
    estadoResultanteId: estados['Parida'].id,
    observaciones: 'Parto doble. Crías ESOV000000205 y ESOV000000206.'
  });

  await crearEventoReproductivo({
    animalId: madres[1].id,
    tipoEvento: 'PARTO',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-01-10',
    numeroCriasVivas: 2,
    numeroCriasMuertas: 0,
    estadoResultanteId: estados['Parida'].id,
    observaciones: 'Parto doble. Crías ESOV000000201 y ESOV000000202.'
  });

  await crearEventoReproductivo({
    animalId: madres[2].id,
    tipoEvento: 'DIAGNOSTICO_GESTACION',
    resultado: 'NEGATIVO',
    fechaEvento: '2025-02-01',
    estadoResultanteId: estados['Vacía'].id,
    observaciones: 'Diagnóstico negativo. Se mantiene vacía.'
  });

  await crearEventoReproductivo({
    animalId: madres[3].id,
    tipoEvento: 'PARTO',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-04-22',
    numeroCriasVivas: 2,
    numeroCriasMuertas: 0,
    estadoResultanteId: estados['Parida'].id,
    observaciones: 'Parto doble. Crías ESOV000000207 y ESOV000000208.'
  });

  await crearEventoReproductivo({
    animalId: madres[4].id,
    tipoEvento: 'CUBRICION',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-11-02',
    estadoResultanteId: estados['Cubierta / Inseminada'].id,
    observaciones: 'Cubrición pendiente de diagnóstico.'
  });

  await crearEventoReproductivo({
    animalId: madres[5].id,
    tipoEvento: 'PARTO',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-02-03',
    numeroCriasVivas: 2,
    numeroCriasMuertas: 0,
    estadoResultanteId: estados['Parida'].id,
    observaciones: 'Parto doble. Crías ESOV000000203 y ESOV000000204.'
  });

  await crearEventoReproductivo({
    animalId: madres[6].id,
    tipoEvento: 'ABORTO',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-09-12',
    numeroCriasVivas: 0,
    numeroCriasMuertas: 1,
    estadoResultanteId: estados['Abortada'].id,
    observaciones: 'Aborto registrado como ejemplo sanitario/reproductivo.'
  });

  await crearEventoReproductivo({
    animalId: madres[7].id,
    tipoEvento: 'PARTO',
    resultado: 'NO_APLICA',
    fechaEvento: '2025-06-05',
    numeroCriasVivas: 2,
    numeroCriasMuertas: 0,
    estadoResultanteId: estados['Parida'].id,
    observaciones: 'Parto doble. Crías ESOV000000209 y ESOV000000210.'
  });

  await crearEventoReproductivo({
    animalId: madres[7].id,
    tipoEvento: 'DIAGNOSTICO_GESTACION',
    resultado: 'POSITIVO',
    fechaEvento: '2025-12-15',
    semanasGestacion: 6,
    fechaPartoEstimada: '2026-04-25',
    estadoResultanteId: estados['Gestante'].id,
    observaciones: 'Nueva gestación confirmada.'
  });

  const caso = await prisma.casoSanitario.create({
    data: {
      unidadRegaId: unidadRega.id,
      animalId: madres[6].id,
      corralId: corrales['Lazareto'].id,
      enfermedadId: enfermedades['Lengua azul'].id,
      fechaInicio: fecha('2025-09-13'),
      signosClinicos: 'Fiebre y decaimiento registrados como caso demo.',
      diagnosticoPresuntivo: 'Sospecha compatible con enfermedad de declaración obligatoria.',
      gravedad: 'Moderada',
      afectaBienestar: true,
      lazareto: true,
      avisoDeclaracionMostrado: true,
      estado: 'ABIERTO'
    }
  });

  await prisma.tratamientoVeterinario.create({
    data: {
      casoSanitarioId: caso.id,
      animalId: madres[6].id,
      corralId: corrales['Lazareto'].id,
      fechaInicio: fecha('2025-09-13'),
      fechaFin: fecha('2025-09-16'),
      motivo: 'Tratamiento de soporte asociado a caso sanitario demo.',
      medicamentoProducto: 'Producto veterinario demo',
      principioActivo: 'Principio activo demo',
      dosisTexto: '2 ml durante 3 días',
      unidad: 'ml',
      via: 'SC',
      frecuencia: 'Cada 24 horas',
      duracionDias: 3,
      retirada: 'Consultar ficha del medicamento',
      documentoUrl: null
    }
  });

  await prisma.vacunacion.create({
    data: {
      unidadRegaId: unidadRega.id,
      corralId: corrales['Producción'].id,
      fecha: fecha('2025-10-01'),
      vacuna: 'Vacuna demo frente a clostridiosis',
      loteVacuna: 'LOT-DEMO-001',
      dosisTexto: '2 ml',
      via: 'SC',
      revacunacionPrevista: true,
      fechaRevacunacion: fecha('2026-10-01'),
      reaccion: false
    }
  });

  await prisma.desparasitacion.create({
    data: {
      unidadRegaId: unidadRega.id,
      corralId: corrales['Cría'].id,
      fecha: fecha('2025-07-01'),
      tipo: 'Interna',
      producto: 'Antiparasitario demo',
      principioActivo: 'Ivermectina demo',
      dosisTexto: 'Según peso',
      via: 'Oral',
      motivo: 'Desparasitación de crías',
      proximaDosisPrevista: true,
      fechaProximaDosis: fecha('2026-01-01'),
      reaccion: false
    }
  });

  const movimientoLote = await prisma.movimientoTransaccion.create({
    data: {
      tipoOperacion: 'LOTE',
      motivo: 'Movimiento de crías a reposición/cebo demo',
      fecha: fecha('2025-07-15'),
      resumen: {
        procesados: 6,
        duplicadosIgnorados: 1,
        noEncontrados: 1,
        yaEnDestino: 0,
        errores: 0
      },
      unidadRegaId: unidadRega.id,
      corralOrigenId: corrales['Cría'].id,
      corralDestinoId: corrales['Reposición'].id,
      userId: admin.id
    }
  });

  const criasProcesadas = [crias[0], crias[2], crias[3], crias[5], crias[7], crias[8]];

  for (const cria of criasProcesadas) {
    await prisma.movimientoAnimalDetalle.create({
      data: {
        transaccionId: movimientoLote.id,
        animalId: cria.id,
        crotalLeido: cria.crotal,
        corralOrigenId: corrales['Cría'].id,
        corralDestinoId: corrales['Reposición'].id,
        estadoProceso: 'PROCESADO',
        observaciones: 'Detalle individual dentro de movimiento en lote.'
      }
    });
  }

  await prisma.movimientoAnimalDetalle.create({
    data: {
      transaccionId: movimientoLote.id,
      animalId: crias[0].id,
      crotalLeido: crias[0].crotal,
      corralOrigenId: corrales['Cría'].id,
      corralDestinoId: corrales['Reposición'].id,
      estadoProceso: 'DUPLICADO_IGNORADO',
      observaciones: 'Crotal leído dos veces durante la operación.'
    }
  });

  await prisma.movimientoAnimalDetalle.create({
    data: {
      transaccionId: movimientoLote.id,
      animalId: null,
      crotalLeido: 'ESOV999999999',
      corralOrigenId: corrales['Cría'].id,
      corralDestinoId: corrales['Reposición'].id,
      estadoProceso: 'NO_ENCONTRADO',
      observaciones: 'Crotal leído no encontrado en la base de datos.'
    }
  });

  const movimientoIndividual = await prisma.movimientoTransaccion.create({
    data: {
      tipoOperacion: 'INDIVIDUAL',
      motivo: 'Paso a lazareto por revisión sanitaria',
      fecha: fecha('2025-09-13'),
      resumen: {
        procesados: 1,
        duplicadosIgnorados: 0,
        noEncontrados: 0,
        yaEnDestino: 0,
        errores: 0
      },
      unidadRegaId: unidadRega.id,
      corralOrigenId: corrales['Vacío'].id,
      corralDestinoId: corrales['Lazareto'].id,
      userId: admin.id
    }
  });

  await prisma.movimientoAnimalDetalle.create({
    data: {
      transaccionId: movimientoIndividual.id,
      animalId: madres[6].id,
      crotalLeido: madres[6].crotal,
      corralOrigenId: corrales['Vacío'].id,
      corralDestinoId: corrales['Lazareto'].id,
      estadoProceso: 'PROCESADO',
      observaciones: 'Movimiento individual asociado a caso sanitario.'
    }
  });

  await prisma.recordatorio.create({
    data: {
      tipo: 'DIAGNOSTICO_GESTACION',
      fechaObjetivo: fecha('2025-12-17'),
      estado: 'PENDIENTE',
      origenRegla: 'OVINO',
      nota: 'Realizar diagnóstico de gestación tras cubrición de ESOV000000105.',
      cuentaGanaderaId: cuenta.id,
      animalId: madres[4].id,
      corralId: corrales['Producción'].id
    }
  });

  await prisma.recordatorio.create({
    data: {
      tipo: 'DECLARACION_OBLIGATORIA',
      fechaObjetivo: fecha('2025-09-13'),
      estado: 'PENDIENTE',
      origenRegla: 'OVINO',
      nota: 'Caso asociado a enfermedad de declaración obligatoria. Revisar comunicación administrativa.',
      cuentaGanaderaId: cuenta.id,
      animalId: madres[6].id,
      corralId: corrales['Lazareto'].id
    }
  });

  await prisma.exportacionRegistro.create({
    data: {
      tipoExportacion: 'CENSO',
      fechaDesde: fecha('2025-01-01'),
      fechaHasta: fecha('2025-12-31'),
      emailDestino: 'demo@rumiando.com',
      estadoEnvio: 'PENDIENTE',
      cuentaGanaderaId: cuenta.id,
      unidadRegaId: unidadRega.id,
      respuestaN8n: {
        demo: true,
        mensaje: 'Exportación demo pendiente de envío por n8n.'
      }
    }
  });

  console.log('Seed ampliado completado correctamente.');
  console.log('Usuarios demo:');
  console.log('ADMIN    -> admin@rumiando.com / 123456');
  console.log('OPERARIO -> operario@rumiando.com / 123456');
  console.log('Animales ovinos creados: 20');
  console.log('Incluye madres, padres, crías, genealogía, reproducción, movimientos, sanidad y recordatorios.');
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


