import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/apiClient';
import AnimalWatchlistButton from '../components/animal-watchlist/AnimalWatchlistButton';

const PRIORITY_RANK = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2
};

function getLevelClass(level) {
  return String(level || 'LOW').toLowerCase();
}

function getLevelText(level) {
  if (level === 'HIGH') return 'Prioridad alta';
  if (level === 'MEDIUM') return 'Prioridad media';
  if (level === 'LOW') return 'Prioridad baja';
  return 'Prioridad no indicada';
}

function getReadableType(type) {
  const labels = {
    BREEDING_RECOMMENDED_AFTER_PRODUCTION: 'Revisión reproductiva recomendada',
    PREGNANCY_DIAGNOSIS_DUE: 'Diagnóstico de gestación pendiente',
    DRY_OFF_RECOMMENDED_AFTER_GESTATION: 'Paso a seca recomendable',
    NO_BIRTH_IN_LAST_YEAR: 'Sin parto registrado en el último año',
    MANDATORY_DISEASE_DECLARATION_NOTICE: 'Aviso sanitario obligatorio'
  };

  return labels[type] || 'Aviso automático';
}

function priorityRank(alert) {
  return PRIORITY_RANK[alert?.level] ?? 99;
}

export default function RemindersPage() {
  const [automaticAlerts, setAutomaticAlerts] = useState([]);
  const [loadingAutomatic, setLoadingAutomatic] = useState(false);
  const [error, setError] = useState('');

  async function loadAutomaticAlerts() {
    setLoadingAutomatic(true);
    setError('');

    try {
      const data = await get('/automation/daily-operational-summary/app');
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

  const sortedAlerts = useMemo(() => (
    [...automaticAlerts].sort((left, right) => {
      const priorityDiff = priorityRank(left) - priorityRank(right);

      if (priorityDiff !== 0) return priorityDiff;

      return String(left.title || '').localeCompare(String(right.title || ''), 'es');
    })
  ), [automaticAlerts]);

  const urgentAlerts = automaticAlerts.filter((alert) => alert.level === 'HIGH');
  const otherAlerts = automaticAlerts.filter((alert) => alert.level !== 'HIGH');

  return (
    <section className="page reminders-page">
      <header className="page-header">
        <div>
          <h2>Avisos</h2>
          <p>
            Aquí tienes los avisos y recomendaciones importantes para priorizar el trabajo
            diario de la explotación.
          </p>
        </div>
      </header>

      {error && <p className="alert error">Error: {error}</p>}

      <div className="metrics-grid reminders-summary-grid">
        <article className="metric-card">
          <span>Total</span>
          <strong>{automaticAlerts.length}</strong>
        </article>

        <article className="metric-card">
          <span>Urgentes</span>
          <strong>{urgentAlerts.length}</strong>
        </article>

        <article className="metric-card">
          <span>Otros</span>
          <strong>{otherAlerts.length}</strong>
        </article>
      </div>

      {loadingAutomatic && <p>Cargando avisos...</p>}

      {!loadingAutomatic && sortedAlerts.length === 0 && (
        <div className="empty-state">
          <h3>No hay avisos</h3>
          <p>No hay recomendaciones pendientes para esta cuenta ganadera.</p>
        </div>
      )}

      {!loadingAutomatic && sortedAlerts.length > 0 && (
        <div className="cards-list reminders-cards-list">
          {sortedAlerts.map((alert, index) => (
            <article className="panel reminder-alert-card" key={`${alert.type}-${alert.animal?.id || index}`}>
              <div className="animal-card-header">
                <span className={`priority ${getLevelClass(alert.level)}`}>
                  {getLevelText(alert.level)}
                </span>
                <span className="tag">{getReadableType(alert.type)}</span>
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

              <div className="form-actions reminder-alert-actions">
                {alert.animal?.id ? (
                  <>
                    <AnimalWatchlistButton
                      animalId={alert.animal.id}
                      motivoTipo={getReadableType(alert.type)}
                      motivoTexto={alert.reason}
                      sourceType="automatic_alert"
                      sourceRef={`${alert.type}-${alert.animal.id}`}
                      promptReason={false}
                      label="Búsqueda"
                      className="secondary"
                    />
                    <Link
                      className="button"
                      to={`/animals/${alert.animal.id}`}
                    >
                      Ficha
                    </Link>
                  </>
                ) : (
                  <button type="button" disabled>
                    Sin ficha
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
