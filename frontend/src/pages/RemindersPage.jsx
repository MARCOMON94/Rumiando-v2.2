import { useEffect, useState } from 'react';
import { post } from '../api/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_KEY = 'rumiando-demo-token-2026';

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
  const [automaticAlerts, setAutomaticAlerts] = useState([]);
  const [cuentaGanaderaId, setCuentaGanaderaId] = useState('1');
  const [loadingAutomatic, setLoadingAutomatic] = useState(false);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

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
    loadAutomaticAlerts();
  }, []);

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
    } catch (err) {
      setError(err.message || 'Error creando recordatorio desde aviso automático');
    }
  }

  const highAlerts = automaticAlerts.filter((alert) => alert.level === 'HIGH');
  const mediumAlerts = automaticAlerts.filter((alert) => alert.level === 'MEDIUM');
  const lowAlerts = automaticAlerts.filter((alert) => alert.level === 'LOW');

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Avisos</p>
          <h2>Avisos automáticos</h2>
          <p>
            Avisos calculados por el backend según el estado real de animales,
            corrales, sanidad y reproducción.
          </p>
        </div>
      </header>

      {error && <p className="alert error">Error: {error}</p>}
      {actionMessage && <p className="alert">{actionMessage}</p>}

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Total avisos</span>
          <strong>{automaticAlerts.length}</strong>
        </article>

        <article className="metric-card">
          <span>Alta prioridad</span>
          <strong>{highAlerts.length}</strong>
        </article>

        <article className="metric-card">
          <span>Media prioridad</span>
          <strong>{mediumAlerts.length}</strong>
        </article>

        <article className="metric-card">
          <span>Baja prioridad</span>
          <strong>{lowAlerts.length}</strong>
        </article>
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Avisos calculados</h3>
            <p>
              Si el ganadero realiza la acción recomendada, el aviso dejará de aparecer
              cuando ya no se cumpla la condición que lo genera.
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
          <div className="empty-state">
            <h3>No hay avisos automáticos</h3>
            <p>No se han calculado avisos para esta cuenta ganadera.</p>
          </div>
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
                  Guardar como recordatorio
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}