const request = require('supertest');

const app = require('../app');
const prisma = require('../config/prisma');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Management rules and safe pen retirement', () => {
  let cookie;
  let adminUser;
  let created;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
    adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@rumiando.com'
      }
    });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    created = {
      accounts: [],
      units: [],
      species: [],
      statuses: [],
      pens: [],
      animals: [],
      rules: []
    };

    const unit = await prisma.unidadRega.create({
      data: {
        codigoRega: `MR-${suffix}`,
        nombre: 'Management Rule Test Unit',
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
    created.units.push(unit.id);

    const species = await prisma.catalogoEspecie.create({
      data: {
        nombre: `Management Species ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
    created.species.push(species.id);

    const status = await prisma.catalogoEstadoReproductivo.create({
      data: {
        nombre: `Gestante Test ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
    created.statuses.push(status.id);

    const pens = await Promise.all([
      prisma.corral.create({
        data: {
          nombre: `Origen ${suffix}`,
          unidadRegaId: unit.id
        }
      }),
      prisma.corral.create({
        data: {
          nombre: `Destino ${suffix}`,
          unidadRegaId: unit.id
        }
      }),
      prisma.corral.create({
        data: {
          nombre: `Vacio ${suffix}`,
          unidadRegaId: unit.id
        }
      })
    ]);
    created.pens.push(...pens.map((pen) => pen.id));

    const animal = await prisma.animal.create({
      data: {
        crotal: `MR${suffix}`,
        sexo: 'HEMBRA',
        unidadRegaId: unit.id,
        especieId: species.id,
        corralActualId: pens[0].id
      }
    });
    created.animals.push(animal.id);

    const externalAccount = await prisma.cuentaGanadera.create({
      data: {
        nombre: `External Management Account ${suffix}`
      }
    });
    created.accounts.push(externalAccount.id);

    const externalUnit = await prisma.unidadRega.create({
      data: {
        codigoRega: `EXT-MR-${suffix}`,
        nombre: 'External Management Unit',
        cuentaGanaderaId: externalAccount.id
      }
    });
    created.units.push(externalUnit.id);

    const externalPen = await prisma.corral.create({
      data: {
        nombre: `External Pen ${suffix}`,
        unidadRegaId: externalUnit.id
      }
    });
    created.pens.push(externalPen.id);
  });

  afterAll(async () => {
    await prisma.managementRule.deleteMany({
      where: {
        OR: [
          { id: { in: created.rules } },
          { triggerCorralId: { in: created.pens } },
          { targetCorralId: { in: created.pens } }
        ]
      }
    });
    await prisma.movimientoAnimalDetalle.deleteMany({
      where: {
        OR: [
          { animalId: { in: created.animals } },
          { corralOrigenId: { in: created.pens } },
          { corralDestinoId: { in: created.pens } }
        ]
      }
    });
    await prisma.movimientoTransaccion.deleteMany({
      where: {
        unidadRegaId: {
          in: created.units
        }
      }
    });
    await prisma.animal.deleteMany({
      where: {
        id: {
          in: created.animals
        }
      }
    });
    await prisma.corral.deleteMany({
      where: {
        id: {
          in: created.pens
        }
      }
    });
    await prisma.catalogoEstadoReproductivo.deleteMany({
      where: {
        id: {
          in: created.statuses
        }
      }
    });
    await prisma.catalogoEspecie.deleteMany({
      where: {
        id: {
          in: created.species
        }
      }
    });
    await prisma.unidadRega.deleteMany({
      where: {
        id: {
          in: created.units
        }
      }
    });
    await prisma.cuentaGanadera.deleteMany({
      where: {
        id: {
          in: created.accounts
        }
      }
    });
    await prisma.$disconnect();
  });

  test('management rules CRUD aisla por cuenta', async () => {
    const [originPen, targetPen] = await prisma.corral.findMany({
      where: {
        id: {
          in: created.pens.slice(0, 2)
        }
      },
      orderBy: {
        id: 'asc'
      }
    });
    const statusId = created.statuses[0];
    const unitId = created.units[0];

    const create = await request(app)
      .post('/api/management-rules')
      .set('Cookie', cookie)
      .send({
        tipo: 'CORRAL_A_REPRODUCCION',
        unidadRegaId: unitId,
        triggerCorralId: originPen.id,
        targetEstadoReproductivoId: statusId,
        targetEventoReproductivo: 'DIAGNOSTICO_GESTACION',
        targetResultadoEvento: 'POSITIVO'
      });

    expect(create.statusCode).toBe(201);
    created.rules.push(create.body.id);
    expect(create.body.triggerCorral.id).toBe(originPen.id);

    const list = await request(app)
      .get('/api/management-rules')
      .set('Cookie', cookie);

    expect(list.statusCode).toBe(200);
    expect(list.body.data.some((rule) => rule.id === create.body.id)).toBe(true);

    const update = await request(app)
      .put(`/api/management-rules/${create.body.id}`)
      .set('Cookie', cookie)
      .send({
        tipo: 'REPRODUCCION_A_CORRAL',
        unidadRegaId: unitId,
        triggerEstadoReproductivoId: statusId,
        targetCorralId: targetPen.id,
        activo: false
      });

    expect(update.statusCode).toBe(200);
    expect(update.body.tipo).toBe('REPRODUCCION_A_CORRAL');
    expect(update.body.activo).toBe(false);

    const externalPenId = created.pens[created.pens.length - 1];
    const crossAccount = await request(app)
      .post('/api/management-rules')
      .set('Cookie', cookie)
      .send({
        tipo: 'CORRAL_A_REPRODUCCION',
        triggerCorralId: externalPenId,
        targetEstadoReproductivoId: statusId
      });

    expect(crossAccount.statusCode).toBe(404);

    const remove = await request(app)
      .delete(`/api/management-rules/${create.body.id}`)
      .set('Cookie', cookie);

    expect(remove.statusCode).toBe(200);
    expect(remove.body.deleted).toBe(true);
  });

  test('pen create rechaza nombres duplicados y devuelve sugerencia', async () => {
    const existingPen = await prisma.corral.findFirst({
      where: {
        id: created.pens[0]
      }
    });

    const duplicate = await request(app)
      .post('/api/pens')
      .set('Cookie', cookie)
      .send({
        nombre: `  ${existingPen.nombre.toUpperCase()}  `,
        unidadRegaId: existingPen.unidadRegaId
      });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body.details.suggestedName).toMatch(new RegExp(`^${existingPen.nombre} \\d+$`));
  });

  test('pen retire bloquea con animales sin destino y mueve con historico si se indica destino', async () => {
    const [sourcePen, targetPen, emptyPen] = await prisma.corral.findMany({
      where: {
        id: {
          in: created.pens.slice(0, 3)
        }
      },
      orderBy: {
        id: 'asc'
      }
    });

    const blocked = await request(app)
      .post(`/api/pens/${sourcePen.id}/retire`)
      .set('Cookie', cookie)
      .send({});

    expect(blocked.statusCode).toBe(400);

    const moved = await request(app)
      .post(`/api/pens/${sourcePen.id}/retire`)
      .set('Cookie', cookie)
      .send({
        moveAnimalsToPenId: targetPen.id
      });

    expect(moved.statusCode).toBe(200);
    expect(moved.body.activo).toBe(false);
    expect(moved.body.movedAnimals).toBe(1);
    expect(moved.body.movementId).toBeDefined();

    const animal = await prisma.animal.findUnique({
      where: {
        id: created.animals[0]
      }
    });

    expect(animal.corralActualId).toBe(targetPen.id);

    const detail = await prisma.movimientoAnimalDetalle.findFirst({
      where: {
        animalId: animal.id,
        corralOrigenId: sourcePen.id,
        corralDestinoId: targetPen.id
      }
    });

    expect(detail).toBeDefined();

    const retireEmpty = await request(app)
      .post(`/api/pens/${emptyPen.id}/retire`)
      .set('Cookie', cookie)
      .send({});

    expect(retireEmpty.statusCode).toBe(200);
    expect(retireEmpty.body.activo).toBe(false);

    const list = await request(app)
      .get('/api/pens')
      .set('Cookie', cookie);

    expect(list.body.data.some((pen) => pen.id === sourcePen.id)).toBe(false);
    expect(list.body.data.some((pen) => pen.id === emptyPen.id)).toBe(false);
  });
});
