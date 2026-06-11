const request = require('supertest');
const app = require('../app');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Exports API', () => {
  let cookie;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
  });

  test('POST /api/exports/send-request registra una solicitud de exportacion', async () => {
    const res = await request(app)
      .post('/api/exports/send-request')
      .set('Cookie', cookie)
      .send({
        tipoExportacion: 'CENSO',
        fechaDesde: '2026-01-01',
        fechaHasta: '2026-12-31',
        emailDestino: 'demo@rumiando.com'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.tipoExportacion).toBe('CENSO');
    expect(res.body.estadoEnvio).toBeDefined();
    expect(res.body.respuestaN8n).toBeDefined();
  });

  test('POST /api/exports/send-request rechaza datos incompletos', async () => {
    const res = await request(app)
      .post('/api/exports/send-request')
      .set('Cookie', cookie)
      .send({
        tipoExportacion: 'CENSO'
      });

    expect(res.statusCode).toBe(400);
  });
});
