const request = require('supertest');

process.env.N8N_API_KEY = process.env.N8N_API_KEY || 'ci-integration-key';

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

  test('GET /api/automation/daily-operational-summary devuelve avisos automaticos con API key', async () => {
    const res = await request(app)
      .get(`/api/automation/daily-operational-summary?cuentaGanaderaId=${cuentaGanaderaId}`)
      .set('x-api-key', process.env.N8N_API_KEY || 'ci-integration-key');

    expect(res.statusCode).toBe(200);
    expect(res.body.type).toBe('DAILY_OPERATIONAL_SUMMARY');
    expect(res.body.farm).toBeDefined();
    expect(res.body.farmUnits).toBeDefined();
    expect(res.body.automaticAlerts).toBeDefined();
    expect(res.body.automaticAlerts.total).toBeDefined();
    expect(res.body.automaticAlerts.high).toBeDefined();
    expect(res.body.automaticAlerts.medium).toBeDefined();
    expect(res.body.automaticAlerts.low).toBeDefined();
    expect(Array.isArray(res.body.automaticAlerts.items)).toBe(true);
    expect(Array.isArray(res.body.automaticAlerts.byPen)).toBe(true);
    expect(res.body.priorities).toBeDefined();
    expect(Array.isArray(res.body.priorities)).toBe(true);
  });

  test('GET /api/automation/weekly-health-summary devuelve resumen sanitario con API key', async () => {
    const res = await request(app)
      .get(`/api/automation/weekly-health-summary?cuentaGanaderaId=${cuentaGanaderaId}`)
      .set('x-api-key', process.env.N8N_API_KEY || 'ci-integration-key');

    expect(res.statusCode).toBe(200);
    expect(res.body.type).toBe('WEEKLY_HEALTH_SUMMARY');
    expect(res.body.farm).toBeDefined();
    expect(res.body.health).toBeDefined();
    expect(res.body.priorities).toBeDefined();
  });
});
