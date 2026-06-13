const request = require('supertest');

const app = require('../app');
const prisma = require('../config/prisma');
const { authCookieForAdmin } = require('./helpers/auth');

function binaryParser(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Analytics API', () => {
  let cookie;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GET /api/analytics/options devuelve filtros base', async () => {
    const res = await request(app)
      .get('/api/analytics/options')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.datasets.some((dataset) => dataset.value === 'animals')).toBe(true);
    expect(res.body.groupBy.some((group) => group.value === 'corral')).toBe(true);
  });

  test('POST /api/analytics/query calcula resumen agrupado', async () => {
    const res = await request(app)
      .post('/api/analytics/query')
      .set('Cookie', cookie)
      .send({
        dataset: 'animals',
        groupBy: 'corral',
        filters: {}
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.dataset).toBe('animals');
    expect(Array.isArray(res.body.summary)).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  test('POST /api/analytics/export/excel devuelve xlsx', async () => {
    const res = await request(app)
      .post('/api/analytics/export/excel')
      .set('Cookie', cookie)
      .buffer(true)
      .parse(binaryParser)
      .send({
        dataset: 'animals',
        groupBy: 'corral',
        filters: {}
      });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(res.body.subarray(0, 2).toString()).toBe('PK');
  });
});
