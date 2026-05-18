require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const animalRoutes = require('./routes/animalRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const penRoutes = require('./routes/penRoutes');
const farmUnitRoutes = require('./routes/farmUnitRoutes');
const movementRoutes = require('./routes/movementRoutes');
const healthRoutes = require('./routes/healthRoutes');
const treatmentRoutes = require('./routes/treatmentRoutes');
const vaccinationRoutes = require('./routes/vaccinationRoutes');
const dewormingRoutes = require('./routes/dewormingRoutes');
const reproductiveEventRoutes = require('./routes/reproductiveEventRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const exportRoutes = require('./routes/exportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const automationRoutes = require('./routes/automationRoutes');


const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/pens', penRoutes);
app.use('/api/farm-units', farmUnitRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/health-cases', healthRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/vaccinations', vaccinationRoutes);
app.use('/api/dewormings', dewormingRoutes);
app.use('/api/reproductive-events', reproductiveEventRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/api/automation', automationRoutes);



app.get('/', (req, res) => {
  res.json({
    message: 'API RumiAndo v2 funcionando',
    routes: [
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/auth/me',

  'GET /api/animals',
  'GET /api/animals/:id',
  'POST /api/animals',
  'PUT /api/animals/:id',

  'GET /api/catalogs',

  'GET /api/pens',
  'GET /api/pens/:id',
  'POST /api/pens',
  'PUT /api/pens/:id',

  'GET /api/farm-units',
  'GET /api/farm-units/:id',
  'POST /api/farm-units',
  'PUT /api/farm-units/:id',

  'GET /api/movements',
  'GET /api/movements/:id',
  'POST /api/movements',

  'GET /api/health-cases',
'GET /api/health-cases/:id',
'POST /api/health-cases',
'PUT /api/health-cases/:id',

'GET /api/treatments',
'GET /api/treatments/:id',
'POST /api/treatments',
'PUT /api/treatments/:id',

'GET /api/vaccinations',
'GET /api/vaccinations/:id',
'POST /api/vaccinations',
'PUT /api/vaccinations/:id',

'GET /api/dewormings',
'GET /api/dewormings/:id',
'POST /api/dewormings',
'PUT /api/dewormings/:id',

'GET /api/reproductive-events',
'GET /api/reproductive-events/:id',
'POST /api/reproductive-events',
'PUT /api/reproductive-events/:id',

'GET /api/reminders',
'GET /api/reminders/:id',
'POST /api/reminders',
'PUT /api/reminders/:id',
'PUT /api/reminders/:id/complete',
'PUT /api/reminders/:id/snooze',

'GET /api/exports/animals',
'GET /api/exports/health-cases',
'GET /api/exports/movements',
'GET /api/exports/reminders',

'GET /api/dashboard',

'GET /api/automation/daily-operational-summary',
'GET /api/automation/weekly-health-summary',


]
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'API RumiAndo v2 funcionando'
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;