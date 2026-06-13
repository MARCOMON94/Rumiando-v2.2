const request = require('supertest');

const app = require('../app');
const prisma = require('../config/prisma');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Account settings API', () => {
  let cookie;
  let adminUser;
  let unit;
  let species;
  let breed;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
    adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@rumiando.com'
      }
    });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    species = await prisma.catalogoEspecie.create({
      data: {
        nombre: `Account Species ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });

    breed = await prisma.catalogoRaza.create({
      data: {
        nombre: `Account Breed ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId,
        especieId: species.id
      }
    });

    unit = await prisma.unidadRega.create({
      data: {
        codigoRega: `AS-${suffix}`,
        nombre: 'Account Settings Unit',
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
  });

  afterAll(async () => {
    await prisma.unidadRega.deleteMany({
      where: {
        id: unit.id
      }
    });
    await prisma.catalogoRaza.deleteMany({
      where: {
        id: breed.id
      }
    });
    await prisma.catalogoEspecie.deleteMany({
      where: {
        id: species.id
      }
    });
    await prisma.$disconnect();
  });

  test('GET /api/account-settings devuelve cuenta, REGAs y usuarios', async () => {
    const res = await request(app)
      .get('/api/account-settings')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(adminUser.cuentaGanaderaId);
    expect(Array.isArray(res.body.unidadesRega)).toBe(true);
    expect(Array.isArray(res.body.usuarios)).toBe(true);
    expect(res.body.usuarios.some((user) => user.email === adminUser.email)).toBe(true);
  });

  test('PUT /api/account-settings/account actualiza datos no sensibles', async () => {
    const res = await request(app)
      .put('/api/account-settings/account')
      .set('Cookie', cookie)
      .send({
        nombre: 'Cuenta test actualizada',
        titularNombre: 'Titular test',
        telefono: '600000000',
        emailContacto: 'contacto-test@rumiando.test'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.nombre).toBe('Cuenta test actualizada');
    expect(res.body.titularNombre).toBe('Titular test');
  });

  test('PUT /api/account-settings/farm-units/:id actualiza REGA, especie y raza', async () => {
    const res = await request(app)
      .put(`/api/account-settings/farm-units/${unit.id}`)
      .set('Cookie', cookie)
      .send({
        nombre: 'Unidad editada',
        codigoRega: `EDIT-${unit.id}`,
        especiePrincipalId: species.id,
        razaPrincipalId: breed.id
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.nombre).toBe('Unidad editada');
    expect(res.body.especiePrincipal.id).toBe(species.id);
    expect(res.body.razaPrincipal.id).toBe(breed.id);
  });

  test('PUT /api/account-settings/users/:id impide quitarse admin a uno mismo', async () => {
    const res = await request(app)
      .put(`/api/account-settings/users/${adminUser.id}`)
      .set('Cookie', cookie)
      .send({
        rol: 'OPERARIO'
      });

    expect(res.statusCode).toBe(400);
  });

  test('PUT /api/account-settings/me actualiza el nombre propio', async () => {
    const res = await request(app)
      .put('/api/account-settings/me')
      .set('Cookie', cookie)
      .send({
        nombre: 'Admin Test Actualizado'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.nombre).toBe('Admin Test Actualizado');
  });
});
