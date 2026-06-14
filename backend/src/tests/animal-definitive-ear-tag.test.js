const request = require('supertest');

const app = require('../app');
const prisma = require('../config/prisma');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Animal definitive ear tag flow', () => {
  let cookie;
  let adminUser;
  let unit;
  let species;
  let provisionalAnimal;
  let definitiveAnimal;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
    adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@rumiando.com'
      }
    });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    unit = await prisma.unidadRega.create({
      data: {
        codigoRega: `CRIA-${suffix}`,
        nombre: `Cria Unit ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });

    species = await prisma.catalogoEspecie.create({
      data: {
        nombre: `Cria Species ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });

    provisionalAnimal = await prisma.animal.create({
      data: {
        crotal: `PROV${suffix}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20),
        crotalDefinitivo: false,
        sexo: 'HEMBRA',
        unidadRegaId: unit.id,
        especieId: species.id
      }
    });

    definitiveAnimal = await prisma.animal.create({
      data: {
        crotal: `DEF${suffix}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20),
        crotalDefinitivo: true,
        sexo: 'HEMBRA',
        unidadRegaId: unit.id,
        especieId: species.id
      }
    });
  });

  afterAll(async () => {
    await prisma.animal.deleteMany({
      where: {
        id: {
          in: [provisionalAnimal?.id, definitiveAnimal?.id].filter(Boolean)
        }
      }
    });
    await prisma.catalogoEspecie.deleteMany({ where: { id: species?.id } });
    await prisma.unidadRega.deleteMany({ where: { id: unit?.id } });
    await prisma.$disconnect();
  });

  test('GET /api/animals permite filtrar crías sin crotal definitivo', async () => {
    const res = await request(app)
      .get('/api/animals?estadoRegistro=ACTIVO&crotalDefinitivo=false')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    const ids = res.body.data.map((animal) => animal.id);
    expect(ids).toContain(provisionalAnimal.id);
    expect(ids).not.toContain(definitiveAnimal.id);
  });

  test('PUT /api/animals/:id actualiza crotal y lo marca como definitivo', async () => {
    const newEarTag = `FINAL${provisionalAnimal.id}`;
    const res = await request(app)
      .put(`/api/animals/${provisionalAnimal.id}`)
      .set('Cookie', cookie)
      .send({
        crotal: newEarTag,
        crotalDefinitivo: true
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.crotal).toBe(newEarTag);
    expect(res.body.crotalDefinitivo).toBe(true);
  });
});
