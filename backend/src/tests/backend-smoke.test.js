const request = require('supertest');
const app = require('../app');

async function loginAsAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@rumiando.com', password: '123456' });

  if (!res.body.token) {
    throw new Error('No se recibió token en login. Ejecuta primero npm run seed.');
  }

  return res.body.token;
}

describe('Backend smoke tests', () => {
  let token;

  beforeAll(async () => {
    token = await loginAsAdmin();
  });

  const protectedGets = [
    '/api/catalogs',
    '/api/dashboard',
    '/api/farm-units',
    '/api/pens',
    '/api/animals',
    '/api/movements',
    '/api/health-cases',
    '/api/treatments',
    '/api/vaccinations',
    '/api/dewormings',
    '/api/reproductive-events',
    '/api/reminders'
  ];

  test.each(protectedGets)('GET %s responde 200 con token', async (url) => {
    const res = await request(app)
      .get(url)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  test('GET /api/dashboard devuelve métricas principales', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.totals).toBeDefined();
  });

  test('GET /api/exports/animals devuelve CSV', async () => {
    const res = await request(app)
      .get('/api/exports/animals')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Crotal');
  });
});
