const request = require('supertest');
const app = require('../app');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Backend smoke tests', () => {
  let cookie;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
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
    '/api/reminders',
    '/api/animal-watchlist'
  ];

  test.each(protectedGets)('GET %s responde 200 con cookie de sesion', async (url) => {
    const res = await request(app)
      .get(url)
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
  });

  test('GET /api/dashboard devuelve metricas principales', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.totals).toBeDefined();
  });

  test('GET /api/exports/animals devuelve CSV', async () => {
    const res = await request(app)
      .get('/api/exports/animals')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Crotal');
  });
});
