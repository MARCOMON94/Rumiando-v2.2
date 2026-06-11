const request = require('supertest');
const app = require('../app');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Reminders API', () => {
  let cookie;
  let createdReminderId;

  beforeAll(async () => {
    cookie = await authCookieForAdmin();
  });

  test('POST /api/reminders crea recordatorio manual', async () => {
    const res = await request(app)
      .post('/api/reminders')
      .set('Cookie', cookie)
      .send({
        tipo: 'REVISION_MANUAL_TEST',
        fechaObjetivo: '2026-06-01',
        origenRegla: 'PERSONALIZADO',
        nota: 'Recordatorio creado desde test automatizado.'
      });

    expect(res.statusCode).toBe(201);
    createdReminderId = res.body.id || res.body.data?.id;
    expect(createdReminderId).toBeDefined();
  });

  test('PUT /api/reminders/:id/snooze pospone recordatorio', async () => {
    const res = await request(app)
      .put(`/api/reminders/${createdReminderId}/snooze`)
      .set('Cookie', cookie)
      .send({ days: 3 });

    expect(res.statusCode).toBe(200);
    expect(res.body.estado || res.body.data?.estado).toBe('POSPUESTO');
  });

  test('PUT /api/reminders/:id/complete completa recordatorio', async () => {
    const res = await request(app)
      .put(`/api/reminders/${createdReminderId}/complete`)
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.estado || res.body.data?.estado).toBe('COMPLETADO');
  });
});
