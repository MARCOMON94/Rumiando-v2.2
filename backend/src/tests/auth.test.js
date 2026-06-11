const request = require('supertest');
const app = require('../app');
const { authCookieForAdmin } = require('./helpers/auth');

describe('Auth API', () => {
  test('POST /api/auth/login rechaza autenticacion por contraseña', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@rumiando.com',
        password: '123456'
      });

    expect(res.statusCode).toBe(410);
    expect(res.body.message).toContain('Google');
  });

  test('GET /api/auth/me rechaza peticion sin cookie de sesion', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/auth/me acepta cookie valida', async () => {
    const cookie = await authCookieForAdmin();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(res.statusCode).toBe(200);
    expect(res.body.email || res.body.user?.email || res.body.usuario?.email).toBeDefined();
  });
});
