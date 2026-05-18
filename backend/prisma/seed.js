require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../src/config/prisma');

function date(value) {
  return new Date(value);
}

function addDays(baseDate, days) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
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

  const manchega = await prisma.catalogoRaza.create({
    data: { nombre: 'Manchega', cuentaGanaderaId: cuentaId, especieId: ovino.id }
  });

  const estadosSeed = [
    ['No aplica', 1],
    ['No reproductor', 2],
    ['Vacía', 3],
    ['Cubierta / Inseminada', 4],
    ['Gestante', 5],
    ['Parida', 6],
    ['Abortada', 7],
    ['Problema reproductivo', 8]
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
      descripcion: 'Enfermedad vírica transmitida por vectores. Incluida como ejemplo de enfermedad de declaración obligatoria.',
      declaracionObligatoria: true,
      requiereLazareto: true
    },
    {
      nombre: 'Brucelosis ovina y caprina',
      descripcion: 'Enfermedad zoonósica incluida como ejemplo de control sanitario oficial.',
      declaracionObligatoria: true,
      requiereLazareto: true
    },
    {
      nombre: 'Agalaxia contagiosa ovina y caprina',
      descripcion: 'Proceso infeccioso relevante en pequeños rumiantes.',
      declaracionObligatoria: false,
      requiereLazareto: true
    },
    {
      nombre: 'Mamitis clínica',
      descripcion: 'Proceso inflamatorio de la glándula mamaria usado como ejemplo sanitario no EDO.',
      declaracionObligatoria: false,
      requiereLazareto: false
    },
    {
      nombre: 'Cojera / pododermatitis',
      descripcion: 'Ejemplo de patología frecuente de manejo.',
      declaracionObligatoria: false,
      requiereLazareto: false
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
    breeds: { majorera, manchega },
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
    { nombre: 'Producción', tipoFuncional: 'PRODUCCION', capacidad: 60, estado: 'Vacía' },
    { nombre: 'Secado', tipoFuncional: 'SECADO', capacidad: 35, estado: 'Gestante' },
    { nombre: 'Paridera', tipoFuncional: 'PARIDERA', capacidad: 25, estado: 'Parida' },
    { nombre: 'Reposición', tipoFuncional: 'REPOSICION', capacidad: 35, estado: 'No reproductor' },
    { nombre: 'Lazareto', tipoFuncional: 'LAZARETO', capacidad: 8, estado: null },
    { nombre: 'Machos', tipoFuncional: 'MACHOS', capacidad: 5, estado: 'No aplica' }
  ];

  const pens = {};

  for (const pen of pensSeed) {
    pens[pen.nombre] = await prisma.corral.create({
      data: {
        nombre: pen.nombre,
        tipoFuncional: pen.tipoFuncional,
        capacidad: pen.capacidad,
        aplicarEstadoAutomaticamente: ['Secado', 'Paridera'].includes(pen.nombre),
        unidadRegaId,
        estadoReproductivoSugeridoId: pen.estado ? estados[pen.estado].id : null
      }
    });
  }

  return pens;
}

async function createAnimalsForFarmUnit({ prefix, internalPrefix, unidadRega, especie, raza, estados, pens, speciesName }) {
  const males = [];
  const adultFemales = [];
  const offspring = [];

  for (let i = 1; i <= 3; i++) {
    const male = await prisma.animal.create({
      data: {
        crotal: `${prefix}M${pad(i)}`,
        numeroInterno: `${internalPrefix}-M-${pad(i)}`,
        sexo: 'MACHO',
        fechaNacimiento: date(`2020-0${i + 1}-10`),
        fechaEntrada: date('2022-01-10'),
        origen: 'Compra de reproductor externo',
        estadoRegistro: 'ACTIVO',
        unidadRegaId: unidadRega.id,
        especieId: especie.id,
        razaId: raza.id,
        corralActualId: pens['Machos'].id,
        estadoReproductivoId: estados['No aplica'].id,
        observaciones: `Macho reproductor ${speciesName} ${raza.nombre}.`
      }
    });

    males.push(male);
  }

  const femaleStates = ['Vacía', 'Gestante', 'Parida', 'Cubierta / Inseminada'];
  const femalePens = ['Producción', 'Secado', 'Paridera', 'Producción'];

  for (let i = 1; i <= 32; i++) {
    const stateName = femaleStates[i % femaleStates.length];
    const penName = femalePens[i % femalePens.length];

    const female = await prisma.animal.create({
      data: {
        crotal: `${prefix}H${pad(i)}`,
        numeroInterno: `${internalPrefix}-H-${pad(i)}`,
        sexo: 'HEMBRA',
        fechaNacimiento: date(`${2018 + (i % 5)}-${pad((i % 12) + 1, 2)}-15`),
        fechaEntrada: date('2023-01-15'),
        origen: i <= 20 ? 'Nacimiento en explotación' : 'Compra de lote reproductor',
        estadoRegistro: 'ACTIVO',
        unidadRegaId: unidadRega.id,
        especieId: especie.id,
        razaId: raza.id,
        corralActualId: pens[penName].id,
        estadoReproductivoId: estados[stateName].id,
        observaciones: `Hembra adulta ${speciesName} ${raza.nombre} generada para demo.`
      }
    });

    adultFemales.push(female);
  }

  for (let i = 1; i <= 15; i++) {
    const mother = adultFemales[(i - 1) % adultFemales.length];
    const father = males[(i - 1) % males.length];

    const child = await prisma.animal.create({
      data: {
        crotal: `${prefix}C${pad(i)}`,
        numeroInterno: `${internalPrefix}-C-${pad(i)}`,
        sexo: 'HEMBRA',
        fechaNacimiento: date(`2025-${pad((i % 6) + 1, 2)}-05`),
        fechaEntrada: date(`2025-${pad((i % 6) + 1, 2)}-05`),
        origen: 'Nacimiento en explotación',
        estadoRegistro: 'ACTIVO',
        unidadRegaId: unidadRega.id,
        especieId: especie.id,
        razaId: raza.id,
        corralActualId: pens['Reposición'].id,
        estadoReproductivoId: estados['No reproductor'].id,
        madreId: mother.id,
        padreId: father.id,
        observaciones: 'Hembra de reposición con madre y padre registrados.'
      }
    });

    offspring.push(child);
  }

  return { males, adultFemales, offspring, all: [...males, ...adultFemales, ...offspring] };
}

async function createDemoRecordsForFarmUnit({ unidadRega, pens, animals, estados, enfermedades, admin, origenRegla }) {
  const motherA = animals.adultFemales[0];
  const motherB = animals.adultFemales[1];
  const motherC = animals.adultFemales[2];
  const father = animals.males[0];
  const childA = animals.offspring[0];
  const sickAnimal = animals.adultFemales[8];

  await prisma.eventoReproductivo.createMany({
    data: [
      {
        animalId: motherA.id,
        tipoEvento: 'CUBRICION',
        resultado: 'NO_APLICA',
        fecha: date('2025-01-10'),
        estadoResultanteId: estados['Cubierta / Inseminada'].id,
        observaciones: `Cubrición natural con macho ${father.crotal}.`
      },
      {
        animalId: motherA.id,
        tipoEvento: 'DIAGNOSTICO_GESTACION',
        resultado: 'POSITIVO',
        fecha: date('2025-02-25'),
        semanasGestacion: 6,
        fechaPartoEstimada: date('2025-06-10'),
        estadoResultanteId: estados['Gestante'].id,
        observaciones: 'Diagnóstico positivo registrado para demo.'
      },
      {
        animalId: motherB.id,
        tipoEvento: 'PARTO',
        resultado: 'NO_APLICA',
        fecha: date('2025-03-12'),
        numeroCriasVivas: 1,
        numeroCriasMuertas: 0,
        estadoResultanteId: estados['Parida'].id,
        observaciones: `Parto simple. Cría relacionada de ejemplo: ${childA.crotal}.`
      },
      {
        animalId: motherC.id,
        tipoEvento: 'DIAGNOSTICO_GESTACION',
        resultado: 'NEGATIVO',
        fecha: date('2025-04-01'),
        estadoResultanteId: estados['Vacía'].id,
        observaciones: 'Diagnóstico negativo usado para mostrar historial reproductivo.'
      }
    ]
  });

  const healthCase = await prisma.casoSanitario.create({
    data: {
      fechaInicio: date('2025-09-13'),
      signosClinicos: 'Fiebre, decaimiento y bajada de producción registrados como demo.',
      diagnosticoPresuntivo: 'Sospecha clínica pendiente de confirmación.',
      diagnosticoConfirmado: null,
      gravedad: 'Moderada',
      afectaBienestar: true,
      lazareto: true,
      avisoDeclaracionMostrado: true,
      estado: 'ABIERTO',
      unidadRegaId: unidadRega.id,
      animalId: sickAnimal.id,
      corralId: pens['Lazareto'].id,
      enfermedadId: enfermedades['Lengua azul'].id
    }
  });

  await prisma.tratamientoVeterinario.create({
    data: {
      fechaInicio: date('2025-09-13'),
      fechaFin: date('2025-09-16'),
      motivo: 'Tratamiento de soporte asociado a caso sanitario demo.',
      medicamentoProducto: 'Producto veterinario demo',
      principioActivo: 'Principio activo demo',
      dosisTexto: '2 ml durante 3 días',
      unidad: 'ml',
      via: 'SC',
      frecuencia: 'Cada 24 horas',
      duracionDias: 3,
      retirada: 'Consultar ficha técnica del medicamento',
      casoSanitarioId: healthCase.id,
      animalId: sickAnimal.id,
      corralId: pens['Lazareto'].id
    }
  });

  await prisma.vacunacion.create({
    data: {
      fecha: date('2025-10-01'),
      vacuna: 'Vacuna demo frente a clostridiosis',
      loteVacuna: 'LOT-DEMO-001',
      dosisTexto: '2 ml',
      via: 'SC',
      revacunacionPrevista: true,
      fechaRevacunacion: date('2026-10-01'),
      reaccion: false,
      unidadRegaId: unidadRega.id,
      corralId: pens['Producción'].id
    }
  });

  await prisma.vacunacion.create({
    data: {
      fecha: date('2025-10-03'),
      vacuna: 'Vacuna demo individual',
      loteVacuna: 'LOT-DEMO-002',
      dosisTexto: '2 ml',
      via: 'SC',
      revacunacionPrevista: false,
      reaccion: false,
      unidadRegaId: unidadRega.id,
      animalId: motherA.id
    }
  });

  await prisma.desparasitacion.create({
    data: {
      fecha: date('2025-07-01'),
      tipo: 'Interna',
      producto: 'Antiparasitario demo',
      principioActivo: 'Ivermectina demo',
      dosisTexto: 'Según peso',
      via: 'Oral',
      motivo: 'Desparasitación de reposición',
      proximaDosisPrevista: true,
      fechaProximaDosis: date('2026-01-01'),
      reaccion: false,
      unidadRegaId: unidadRega.id,
      corralId: pens['Reposición'].id
    }
  });

  const movement = await prisma.movimientoTransaccion.create({
    data: {
      tipoOperacion: 'LOTE',
      motivo: 'Movimiento demo de reposición a producción',
      fecha: date('2025-11-10'),
      resumen: {
        totalLeidos: 5,
        procesados: 3,
        noEncontrados: 1,
        yaEnDestino: 1
      },
      unidadRegaId: unidadRega.id,
      corralOrigenId: pens['Reposición'].id,
      corralDestinoId: pens['Producción'].id,
      userId: admin.id
    }
  });

  const movedAnimals = animals.offspring.slice(0, 3);

  for (const animal of movedAnimals) {
    await prisma.movimientoAnimalDetalle.create({
      data: {
        transaccionId: movement.id,
        animalId: animal.id,
        crotalLeido: animal.crotal,
        estadoProceso: 'PROCESADO',
        corralOrigenId: pens['Reposición'].id,
        corralDestinoId: pens['Producción'].id,
        observaciones: 'Procesado dentro de movimiento en lote demo.'
      }
    });

    await prisma.animal.update({
      where: { id: animal.id },
      data: { corralActualId: pens['Producción'].id }
    });
  }

  await prisma.movimientoAnimalDetalle.create({
    data: {
      transaccionId: movement.id,
      crotalLeido: `${unidadRega.codigoRega}-NOEXISTE`,
      estadoProceso: 'NO_ENCONTRADO',
      corralDestinoId: pens['Producción'].id,
      observaciones: 'Crotal leído no encontrado en esta unidad REGA.'
    }
  });

  await prisma.movimientoAnimalDetalle.create({
    data: {
      transaccionId: movement.id,
      animalId: motherA.id,
      crotalLeido: motherA.crotal,
      estadoProceso: 'YA_EN_DESTINO',
      corralOrigenId: pens['Producción'].id,
      corralDestinoId: pens['Producción'].id,
      observaciones: 'Animal ya estaba en el corral destino.'
    }
  });

  await prisma.recordatorio.createMany({
    data: [
      {
        tipo: 'REVISION_SANITARIA',
        fechaObjetivo: addDays(new Date(), 7),
        estado: 'PENDIENTE',
        origenRegla,
        nota: 'Revisar evolución del caso sanitario abierto.',
        cuentaGanaderaId: unidadRega.cuentaGanaderaId,
        animalId: sickAnimal.id,
        corralId: pens['Lazareto'].id
      },
      {
        tipo: 'CAMBIO_CORRAL',
        fechaObjetivo: addDays(new Date(), 14),
        estado: 'POSPUESTO',
        pospuestoHasta: addDays(new Date(), 17),
        origenRegla,
        nota: 'Valorar paso de reposición a producción.',
        cuentaGanaderaId: unidadRega.cuentaGanaderaId,
        animalId: childA.id,
        corralId: pens['Reposición'].id
      }
    ]
  });

  await prisma.exportacionRegistro.create({
    data: {
      tipoExportacion: 'CENSO',
      fechaDesde: date('2025-01-01'),
      fechaHasta: date('2025-12-31'),
      emailDestino: 'admin@rumiando.com',
      estadoEnvio: 'PENDIENTE',
      urlExcel: null,
      urlPdf: null,
      respuestaN8n: {
        demo: true,
        message: 'Registro preparado para futura integración con n8n.'
      },
      cuentaGanaderaId: unidadRega.cuentaGanaderaId,
      unidadRegaId: unidadRega.id
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

  const caprinoAnimals = await createAnimalsForFarmUnit({
    prefix: 'ESCAPMAJ',
    internalPrefix: 'CAP-MAJ',
    unidadRega: regaCaprino,
    especie: species.caprino,
    raza: breeds.majorera,
    estados,
    pens: pensCaprino,
    speciesName: 'caprino'
  });

  const ovinoAnimals = await createAnimalsForFarmUnit({
    prefix: 'ESOVMAN',
    internalPrefix: 'OV-MAN',
    unidadRega: regaOvino,
    especie: species.ovino,
    raza: breeds.manchega,
    estados,
    pens: pensOvino,
    speciesName: 'ovino'
  });

  await createDemoRecordsForFarmUnit({
    unidadRega: regaCaprino,
    pens: pensCaprino,
    animals: caprinoAnimals,
    estados,
    enfermedades,
    admin,
    origenRegla: 'CAPRINO'
  });

  await createDemoRecordsForFarmUnit({
    unidadRega: regaOvino,
    pens: pensOvino,
    animals: ovinoAnimals,
    estados,
    enfermedades,
    admin,
    origenRegla: 'OVINO'
  });

  console.log('Seed completado.');
  console.log('Usuarios demo:');
  console.log('ADMIN -> admin@rumiando.com / 123456');
  console.log('OPERARIO -> operario@rumiando.com / 123456');
  console.log('Datos creados: 2 REGA, 100 animales, relaciones familiares, sanidad, reproducción, movimientos, recordatorios y exportaciones.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
