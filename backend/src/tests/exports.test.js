const request = require('supertest');
const app = require('../app');

async function loginAsAdmin() {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@rumiando.com', password: '123456' });

  return login.body.token;
}

describe('Exports API', () => {
  let token;

  beforeAll(async () => {
    token = await loginAsAdmin();
  });

  test('POST /api/exports/send-request registra una solicitud de exportación', async () => {
    const res = await request(app)
      .post('/api/exports/send-request')
      .set('Authorization', `Bearer ${token}`)
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
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipoExportacion: 'CENSO'
      });

    expect(res.statusCode).toBe(400);
  });
});