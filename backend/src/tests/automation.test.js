const request = require('supertest');
const app = require('../app');
const prisma = require('../config/prisma');

async function getDemoFarmAccountId() {
  const farmAccount = await prisma.cuentaGanadera.findFirst({
    orderBy: {
      id: 'asc'
    }
  });

  if (!farmAccount) {
    throw new Error('No existe ninguna cuenta ganadera. Ejecuta npm run seed antes de los tests.');
  }

  return farmAccount.id;
}

describe('Automation API', () => {
  let cuentaGanaderaId;

  beforeAll(async () => {
    cuentaGanaderaId = await getDemoFarmAccountId();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GET /api/automation/daily-operational-summary rechaza sin API key', async () => {
    const res = await request(app).get('/api/automation/daily-operational-summary');

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/automation/daily-operational-summary devuelve resumen con API key', async () => {
    const res = await request(app)
      .get(`/api/automation/daily-operational-summary?cuentaGanaderaId=${cuentaGanaderaId}`)
      .set('x-api-key', process.env.N8N_API_KEY || 'rumiando-demo-token-2026');

    expect(res.statusCode).toBe(200);
    expect(res.body.type).toBe('DAILY_OPERATIONAL_SUMMARY');
    expect(res.body.farm).toBeDefined();
    expect(res.body.reminders).toBeDefined();
    expect(res.body.penMovementAlerts).toBeDefined();
    expect(res.body.priorities).toBeDefined();
  });

  test('GET /api/automation/weekly-health-summary devuelve resumen sanitario con API key', async () => {
    const res = await request(app)
      .get(`/api/automation/weekly-health-summary?cuentaGanaderaId=${cuentaGanaderaId}`)
      .set('x-api-key', process.env.N8N_API_KEY || 'rumiando-demo-token-2026');

    expect(res.statusCode).toBe(200);
    expect(res.body.type).toBe('WEEKLY_HEALTH_SUMMARY');
    expect(res.body.farm).toBeDefined();
    expect(res.body.health).toBeDefined();
    expect(res.body.priorities).toBeDefined();
  });
});