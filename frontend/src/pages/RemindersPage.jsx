import { useEffect, useState } from 'react';
import { get, post, put } from '../api/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_KEY = 'rumiando-demo-token-2026';

function getItems(data, keys) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no válida';
  }

  return date.toLocaleDateString();
}

function getLevelClass(level) {
  return String(level || 'LOW').toLowerCase();
}

function getReminderOrigin(alert) {
  const species = String(alert.animal?.species || '').toUpperCase();

  if (species.includes('OVINO')) return 'OVINO';
  if (species.includes('CAPRINO')) return 'CAPRINO';

  return 'PERSONALIZADO';
}

function buildReminderNote(alert) {
  return [
    alert.title,
    alert.reason,
    alert.suggestedAction,
    alert.animal?.earTag ? `Crotal: ${alert.animal.earTag}` : null,
    alert.penName ? `Corral: ${alert.penName}` : null
  ]
    .filter(Boolean)
    .join(' | ');
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [automaticAlerts, setAutomaticAlerts] = useState([]);
  const [cuentaGanaderaId, setCuentaGanaderaId] = useState('1');

  const [loadingReminders, setLoadingReminders] = useState(true);
  const [loadingAutomatic, setLoadingAutomatic] = useState(false);

  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  async function loadReminders() {
    setLoadingReminders(true);
    setError('');

    try {
      const data = await get('/reminders?pending=true');
      setReminders(getItems(data, ['data', 'reminders', 'recordatorios']));
    } catch (err) {
      setError(err.message || 'Error cargando recordatorios');
    } finally {
      setLoadingReminders(false);
    }
  }

  async function loadAutomaticAlerts() {
    setLoadingAutomatic(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/automation/daily-operational-summary?cuentaGanaderaId=${cuentaGanaderaId}`,
        {
          headers: {
            'x-api-key': API_KEY
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error cargando avisos automáticos');
      }

      setAutomaticAlerts(data.automaticAlerts?.items || []);
    } catch (err) {
      setError(err.message || 'Error cargando avisos automáticos');
    } finally {
      setLoadingAutomatic(false);
    }
  }

  useEffect(() => {
    loadReminders();
    loadAutomaticAlerts();
  }, []);

  async function completeReminder(id) {
    setActionMessage('');
    setError('');

    try {
      await put(`/reminders/${id}/complete`, {});
      setActionMessage('Recordatorio completado.');
      await loadReminders();
    } catch (err) {
      setError(err.message || 'Error completando recordatorio');
    }
  }

  async function snoozeReminder(id, days) {
    setActionMessage('');
    setError('');

    try {
      await put(`/reminders/${id}/snooze`, { days });
      setActionMessage(`Recordatorio pospuesto ${days} días.`);
      await loadReminders();
    } catch (err) {
      setError(err.message || 'Error posponiendo recordatorio');
    }
  }

  async function createReminderFromAutomaticAlert(alert) {
    setActionMessage('');
    setError('');

    try {
      const payload = {
        tipo: alert.type,
        fechaObjetivo: new Date().toISOString(),
        estado: 'PENDIENTE',
        origenRegla: getReminderOrigin(alert),
        nota: buildReminderNote(alert),
        animalId: alert.animal?.id || null,
        corralId: alert.penId && Number(alert.penId) ? Number(alert.penId) : null
      };

      await post('/reminders', payload);

      setActionMessage('Aviso automático convertido en recordatorio.');
      await loadReminders();
    } catch (err) {
      setError(err.message || 'Error creando recordatorio desde aviso automático');
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Avisos</p>
          <h2>Recordatorios y avisos automáticos</h2>
          <p>
            Vista unificada de recordatorios gestionables y avisos calculados por el backend.
          </p>
        </div>
      </header>

      {error && <p className="alert error">Error: {error}</p>}
      {actionMessage && <p className="alert">{actionMessage}</p>}

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Recordatorios pendientes</span>
          <strong>{reminders.length}</strong>
        </article>

        <article className="metric-card">
          <span>Avisos automáticos</span>
          <strong>{automaticAlerts.length}</strong>
        </article>

        <article className="metric-card">
          <span>Alta prioridad</span>
          <strong>
            {automaticAlerts.filter((alert) => alert.level === 'HIGH').length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Media prioridad</span>
          <strong>
            {automaticAlerts.filter((alert) => alert.level === 'MEDIUM').length}
          </strong>
        </article>
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Recordatorios gestionables</h3>
            <p>Estos avisos están guardados en base de datos y pueden completarse o posponerse.</p>
          </div>

          <button type="button" onClick={loadReminders}>
            Recargar
          </button>
        </div>

        {loadingReminders && <p>Cargando recordatorios...</p>}

        {!loadingReminders && reminders.length === 0 && (
          <p>No hay recordatorios pendientes o pospuestos.</p>
        )}

        {!loadingReminders && reminders.length > 0 && (
          <div className="cards-list">
            {reminders.map((reminder) => (
              <article className="panel" key={reminder.id}>
                <div className="animal-card-header">
                  <span className="tag">{reminder.estado}</span>
                  <span>{reminder.origenRegla || 'Sin origen'}</span>
                </div>

                <h3>{reminder.tipo}</h3>

                <p>
                  <strong>Fecha objetivo:</strong>{' '}
                  {formatDate(reminder.fechaObjetivo)}
                </p>

                {reminder.pospuestoHasta && (
                  <p>
                    <strong>Pospuesto hasta:</strong>{' '}
                    {formatDate(reminder.pospuestoHasta)}
                  </p>
                )}

                <p>
                  <strong>Animal:</strong>{' '}
                  {reminder.animal?.crotal || 'Sin animal asociado'}
                </p>

                <p>
                  <strong>Corral:</strong>{' '}
                  {reminder.corral?.nombre ||
                    reminder.animal?.corralActual?.nombre ||
                    'Sin corral'}
                </p>

                {reminder.nota && <p>{reminder.nota}</p>}

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => completeReminder(reminder.id)}
                  >
                    Completar
                  </button>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => snoozeReminder(reminder.id, 7)}
                  >
                    Posponer 7 días
                  </button>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => snoozeReminder(reminder.id, 30)}
                  >
                    Posponer 30 días
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Avisos automáticos calculados</h3>
            <p>
              Estos avisos vienen del motor de automatización. Si quieres gestionarlos,
              conviértelos en recordatorio.
            </p>
          </div>

          <div className="inline-controls">
            <input
              value={cuentaGanaderaId}
              onChange={(event) => setCuentaGanaderaId(event.target.value)}
              aria-label="Cuenta ganadera ID"
            />

            <button type="button" onClick={loadAutomaticAlerts}>
              Recalcular
            </button>
          </div>
        </div>

        {loadingAutomatic && <p>Cargando avisos automáticos...</p>}

        {!loadingAutomatic && automaticAlerts.length === 0 && (
          <p>No hay avisos automáticos calculados.</p>
        )}

        {!loadingAutomatic && automaticAlerts.length > 0 && (
          <div className="cards-list">
            {automaticAlerts.map((alert, index) => (
              <article className="panel" key={`${alert.type}-${alert.animal?.id || index}`}>
                <div className="animal-card-header">
                  <span className={`priority ${getLevelClass(alert.level)}`}>
                    {alert.level}
                  </span>
                  <span>{alert.type}</span>
                </div>

                <h3>{alert.title}</h3>

                <p>{alert.reason}</p>

                <p>
                  <strong>Acción sugerida:</strong>{' '}
                  {alert.suggestedAction}
                </p>

                <p>
                  <strong>Crotal:</strong>{' '}
                  {alert.animal?.earTag || 'Sin animal'}
                </p>

                <p>
                  <strong>Corral:</strong>{' '}
                  {alert.animal?.currentPen || alert.penName || 'Sin corral'}
                </p>

                <button
                  type="button"
                  onClick={() => createReminderFromAutomaticAlert(alert)}
                >
                  Crear recordatorio
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}