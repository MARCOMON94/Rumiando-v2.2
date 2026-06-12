import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/apiClient';
import AnimalWatchlistButton from '../components/animal-watchlist/AnimalWatchlistButton';

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

        <button type="button" onClick={loadAutomaticAlerts}>
          Recalcular avisos
        </button>
      </header>

      {error && <p className="alert error">Error: {error}</p>}

      <div className="metrics-grid">
  <article className="metric-card">
    <span>Total avisos</span>
    <strong>{automaticAlerts.length}</strong>
  </article>

  <article className="metric-card">
    <span>Avisos urgentes</span>
    <strong>{highAlerts.length}</strong>
  </article>

  <article className="metric-card">
    <span>Avisos importantes</span>
    <strong>{mediumAlerts.length}</strong>
  </article>

  <article className="metric-card">
    <span>Avisos leves</span>
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

                <div className="form-actions">
                  {alert.animal?.id ? (
                    <>
                      <AnimalWatchlistButton
                        animalId={alert.animal.id}
                        motivoTipo={getReadableType(alert.type)}
                        motivoTexto={alert.reason}
                        sourceType="automatic_alert"
                        sourceRef={`${alert.type}-${alert.animal.id}`}
                        promptReason={false}
                        label="Animal Watchlist"
                        className="secondary"
                      />
                      <Link
                        className="button"
                        to={`/animals/${alert.animal.id}`}
                      >
                        Ver ficha animal
                      </Link>
                    </>
                  ) : (
                    <button type="button" disabled>
                      Sin ficha asociada
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
