const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../app');
const prisma = require('../config/prisma');
const { authCookieForAdmin } = require('./helpers/auth');
const { getSessionCookieName } = require('../utils/sessionCookie');

function cookieForUser(user) {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol,
      cuentaGanaderaId: user.cuentaGanaderaId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    }
  );

  return `${getSessionCookieName()}=${token}`;
}

describe('Animal Watchlist API', () => {
  let cookie;
  let otherCookie;
  let adminUser;
  let otherUser;
  let animal;
  let externalAnimal;
  let itemId;
  let createdIds;

  beforeAll(async () => {
    process.env.JWT_SECRET ||= 'test-secret';
    cookie = await authCookieForAdmin();
    adminUser = await prisma.user.findUnique({
      where: {
        email: 'admin@rumiando.com'
      }
    });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    createdIds = {
      users: [],
      accounts: [],
      units: [],
      species: [],
      pens: [],
      animals: []
    };

    const unit = await prisma.unidadRega.create({
      data: {
        codigoRega: `AW-${suffix}`,
        nombre: 'Animal Watchlist Test Unit',
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
    createdIds.units.push(unit.id);

    const species = await prisma.catalogoEspecie.create({
      data: {
        nombre: `Watchlist Species ${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
    createdIds.species.push(species.id);

    const pen = await prisma.corral.create({
      data: {
        nombre: `Watchlist Pen ${suffix}`,
        unidadRegaId: unit.id
      }
    });
    createdIds.pens.push(pen.id);

    animal = await prisma.animal.create({
      data: {
        crotal: `AW${suffix}`,
        numeroInterno: `INT${suffix}`,
        sexo: 'HEMBRA',
        unidadRegaId: unit.id,
        especieId: species.id,
        corralActualId: pen.id
      }
    });
    createdIds.animals.push(animal.id);

    otherUser = await prisma.user.create({
      data: {
        nombre: 'Other Watchlist User',
        email: `watchlist-${suffix}@rumiando.test`,
        rol: 'OPERARIO',
        authProvider: 'GOOGLE',
        googleSub: `watchlist-${suffix}`,
        cuentaGanaderaId: adminUser.cuentaGanaderaId
      }
    });
    createdIds.users.push(otherUser.id);
    otherCookie = cookieForUser(otherUser);

    const externalAccount = await prisma.cuentaGanadera.create({
      data: {
        nombre: `External Watchlist Account ${suffix}`
      }
    });
    createdIds.accounts.push(externalAccount.id);

    const externalUnit = await prisma.unidadRega.create({
      data: {
        codigoRega: `EXT-AW-${suffix}`,
        nombre: 'External Watchlist Unit',
        cuentaGanaderaId: externalAccount.id
      }
    });
    createdIds.units.push(externalUnit.id);

    const externalSpecies = await prisma.catalogoEspecie.create({
      data: {
        nombre: `External Species ${suffix}`,
        cuentaGanaderaId: externalAccount.id
      }
    });
    createdIds.species.push(externalSpecies.id);

    externalAnimal = await prisma.animal.create({
      data: {
        crotal: `EXTAW${suffix}`,
        sexo: 'HEMBRA',
        unidadRegaId: externalUnit.id,
        especieId: externalSpecies.id
      }
    });
    createdIds.animals.push(externalAnimal.id);
  });

  afterAll(async () => {
    await prisma.animalWatchlistItem.deleteMany({
      where: {
        animalId: {
          in: createdIds.animals
        }
      }
    });
    await prisma.animal.deleteMany({
      where: {
        id: {
          in: createdIds.animals
        }
      }
    });
    await prisma.corral.deleteMany({
      where: {
        id: {
          in: createdIds.pens
        }
      }
    });
    await prisma.catalogoEspecie.deleteMany({
      where: {
        id: {
          in: createdIds.species
        }
      }
    });
    await prisma.unidadRega.deleteMany({
      where: {
        id: {
          in: createdIds.units
        }
      }
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdIds.users
        }
      }
    });
    await prisma.cuentaGanadera.deleteMany({
      where: {
        id: {
          in: createdIds.accounts
        }
      }
    });
    await prisma.$disconnect();
  });

  test('POST /api/animal-watchlist crea item y evita duplicados', async () => {
    const first = await request(app)
      .post('/api/animal-watchlist')
      .set('Cookie', cookie)
      .send({
        animalId: animal.id,
        motivoTexto: 'Revisar en manga',
        sourceType: 'manual'
      });

    expect(first.statusCode).toBe(201);
    itemId = first.body.id;
    expect(first.body.animal.crotal).toBe(animal.crotal);

    const duplicate = await request(app)
      .post('/api/animal-watchlist')
      .set('Cookie', cookie)
      .send({
        animalId: animal.id
      });

    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.body.id).toBe(itemId);
    expect(duplicate.body.motivoTexto).toBe('Revisar en manga');

    const list = await request(app)
      .get('/api/animal-watchlist')
      .set('Cookie', cookie);

    expect(list.statusCode).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.pendingTotal).toBe(1);
    expect(list.body.seenTotal).toBe(0);
  });

  test('GET /api/animal-watchlist aisla la lista por usuario', async () => {
    const otherList = await request(app)
      .get('/api/animal-watchlist')
      .set('Cookie', otherCookie);

    expect(otherList.statusCode).toBe(200);
    expect(otherList.body.total).toBe(0);
  });

  test('POST /api/animal-watchlist impide animales de otra cuenta', async () => {
    const res = await request(app)
      .post('/api/animal-watchlist')
      .set('Cookie', cookie)
      .send({
        animalId: externalAnimal.id
      });

    expect(res.statusCode).toBe(404);
  });

  test('POST /api/animal-watchlist/read marca visto e incrementa seenCount', async () => {
    const firstRead = await request(app)
      .post('/api/animal-watchlist/read')
      .set('Cookie', cookie)
      .send({
        crotal: animal.crotal
      });

    expect(firstRead.statusCode).toBe(200);
    expect(firstRead.body.matched).toBe(true);
    expect(firstRead.body.data[0].seenCount).toBe(1);
    expect(firstRead.body.data[0].seenAt).toBeDefined();

    const secondRead = await request(app)
      .post('/api/animal-watchlist/read')
      .set('Cookie', cookie)
      .send({
        crotal: animal.crotal
      });

    expect(secondRead.statusCode).toBe(200);
    expect(secondRead.body.data[0].seenCount).toBe(2);

    const list = await request(app)
      .get('/api/animal-watchlist')
      .set('Cookie', cookie);

    expect(list.body.total).toBe(1);
    expect(list.body.seenTotal).toBe(1);
    expect(list.body.pendingTotal).toBe(0);
  });

  test('DELETE /api/animal-watchlist/:id elimina item y DELETE /api/animal-watchlist vacia lista', async () => {
    const deleteOne = await request(app)
      .delete(`/api/animal-watchlist/${itemId}`)
      .set('Cookie', cookie);

    expect(deleteOne.statusCode).toBe(200);
    expect(deleteOne.body.deleted).toBe(true);

    await request(app)
      .post('/api/animal-watchlist')
      .set('Cookie', cookie)
      .send({
        animalId: animal.id
      });

    const clear = await request(app)
      .delete('/api/animal-watchlist')
      .set('Cookie', cookie);

    expect(clear.statusCode).toBe(200);
    expect(clear.body.deleted).toBe(1);

    const list = await request(app)
      .get('/api/animal-watchlist')
      .set('Cookie', cookie);

    expect(list.body.total).toBe(0);
  });
});
