const request = require('supertest');
const app = require('../app');

describe('Auth API', () => {
  test('POST /api/auth/login devuelve token con usuario demo', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@rumiando.com',
        password: '123456'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user || res.body.usuario).toBeDefined();
  });

  test('GET /api/auth/me rechaza petición sin token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/auth/me acepta token válido', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@rumiando.com', password: '123456' });

    const token = login.body.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.email || res.body.user?.email || res.body.usuario?.email).toBeDefined();
  });
});
