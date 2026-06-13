const request = require('supertest');

const app = require('../app');
const prisma = require('../config/prisma');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Catalog API', () => {
  let cookie;
  let adminUser;
  let aliasDisease;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
    adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@rumiando.com'
      }
    });

    aliasDisease = await prisma.catalogoEnfermedad.create({
      data: {
        nombre: `Mamitis Test ${Date.now()}`,
        aliases: ['mastitis-test-local'],
        gravedadSugerida: 'MEDIA',
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
  });

  afterAll(async () => {
    await prisma.catalogoVacuna.deleteMany({
      where: {
        cuentaGanaderaId: adminUser.cuentaGanaderaId,
        nombre: {
          startsWith: 'Vacuna Test '
        }
      }
    });
    await prisma.catalogoEnfermedad.deleteMany({
      where: {
        id: aliasDisease.id
      }
    });
    await prisma.$disconnect();
  });

  test('GET /api/catalogs devuelve especies base y catalogos sanitarios', async () => {
    const res = await request(app)
      .get('/api/catalogs')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.species.some((item) => item.nombre === 'Otras especies')).toBe(true);
    expect(res.body.species.some((item) => item.nombre === 'Equino')).toBe(true);
    expect(res.body.breeds.some((item) => item.nombre === 'Otros animales')).toBe(true);
    expect(Array.isArray(res.body.vaccines)).toBe(true);
    expect(Array.isArray(res.body.dewormers)).toBe(true);
  });

  test('POST /api/catalogs/sanitary-normalize resuelve alias local', async () => {
    const res = await request(app)
      .post('/api/catalogs/sanitary-normalize')
      .set('Cookie', cookie)
      .send({
        type: 'disease',
        text: 'mastitis-test-local'
      });

    expect(res.statusCode).toBe(200);
    expect(['matched', 'suggested']).toContain(res.body.status);
    expect(res.body.item.nombre).toBe(aliasDisease.nombre);
  });

  test('POST /api/catalogs/sanitary-normalize crea catalogo manual si no hay sugerencia', async () => {
    const name = `Vacuna Test ${Date.now()}`;
    const res = await request(app)
      .post('/api/catalogs/sanitary-normalize')
      .set('Cookie', cookie)
      .send({
        type: 'vaccination',
        text: name,
        createIfMissing: true
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('created');
    expect(res.body.item.nombre).toBe(name);
  });
});
