require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
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
const aiRoutes = require('./routes/aiRoutes');
const animalWatchlistRoutes = require('./routes/animalWatchlistRoutes');

const automationRoutes = require('./routes/automationRoutes');


const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

function splitOrigins(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://rumiando.netlify.app',
  ...splitOrigins(process.env.FRONTEND_URL),
  ...splitOrigins(process.env.FRONTEND_URLS)
].filter(Boolean));

function isDevelopmentOrigin(origin) {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const url = new URL(origin);
    const isDevPort = ['5173', '5174'].includes(url.port);
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const isPrivateLan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url.hostname);

    return isDevPort && (isLocalHost || isPrivateLan);
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isDevelopmentOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/invitations', invitationRoutes);
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
app.use('/api/ai', aiRoutes);
app.use('/api/animal-watchlist', animalWatchlistRoutes);

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
'POST /api/exports/send-request',

'GET /api/dashboard',

'GET /api/animal-watchlist',
'POST /api/animal-watchlist',
'POST /api/animal-watchlist/read',
'DELETE /api/animal-watchlist/:id',
'DELETE /api/animal-watchlist',

'GET /api/ai/health',
'POST /api/ai/chat',
'GET /api/ai/chat/history/:conversationId',
'GET /api/ai/learning/unresolved',
'GET /api/ai/learning/weekly-summary',

'GET /api/automation/daily-operational-summary/app',
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
