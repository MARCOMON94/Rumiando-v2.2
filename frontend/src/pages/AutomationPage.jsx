import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_KEY = 'rumiando-demo-token-2026';

export default function AutomationPage() {
  const [summary, setSummary] = useState(null);
  const [cuentaGanaderaId, setCuentaGanaderaId] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadSummary() {
    setLoading(true);
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
        throw new Error(data.message || 'Error al cargar avisos');
      }

      setSummary(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  const alerts = summary?.automaticAlerts?.items || [];

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Automatización</p>
          <h2>Avisos automáticos</h2>
          <p>Resumen diario calculado desde datos reproductivos y sanitarios.</p>
        </div>
      </header>

      <div className="filters-card">
        <label>
          Cuenta ganadera ID
          <input
            value={cuentaGanaderaId}
            onChange={(event) => setCuentaGanaderaId(event.target.value)}
          />
        </label>

        <button type="button" onClick={loadSummary}>
          Recargar avisos
        </button>
      </div>

      {loading && <p>Cargando avisos...</p>}
      {error && <p className="alert error">Error: {error}</p>}

      {summary && (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Total avisos</span>
              <strong>{summary.automaticAlerts?.total || 0}</strong>
            </article>

            <article className="metric-card">
              <span>Alta prioridad</span>
              <strong>{summary.automaticAlerts?.high || 0}</strong>
            </article>

            <article className="metric-card">
              <span>Media prioridad</span>
              <strong>{summary.automaticAlerts?.medium || 0}</strong>
            </article>

            <article className="metric-card">
              <span>Baja prioridad</span>
              <strong>{summary.automaticAlerts?.low || 0}</strong>
            </article>
          </div>

          <div className="cards-list">
            {alerts.map((alert, index) => (
              <article className="panel" key={`${alert.type}-${index}`}>
                <div className="animal-card-header">
                  <span className={`priority ${alert.level?.toLowerCase()}`}>
                    {alert.level}
                  </span>
                  <span>{alert.type}</span>
                </div>

                <h3>{alert.title}</h3>
                <p>{alert.reason}</p>
                <p><strong>Acción:</strong> {alert.suggestedAction}</p>
                <p><strong>Crotal:</strong> {alert.animal?.earTag || 'Sin animal'}</p>
                <p><strong>Corral:</strong> {alert.animal?.currentPen || alert.penName || 'Sin corral'}</p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}