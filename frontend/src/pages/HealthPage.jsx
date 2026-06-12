import { useEffect, useState } from 'react';
import { get } from '../api/apiClient';

function getHealthCasesFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.healthCases)) return data.healthCases;
  if (Array.isArray(data.casosSanitarios)) return data.casosSanitarios;
  return [];
}

export default function HealthPage() {
  const [healthCases, setHealthCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadHealthCases() {
      try {
        const data = await get('/health-cases');
        setHealthCases(getHealthCasesFromResponse(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadHealthCases();
  }, []);

  const openCases = healthCases.filter((healthCase) => {
    return healthCase.estado === 'ABIERTO' || healthCase.fechaFin === null;
  });

  if (loading) {
    return <p>Cargando casos sanitarios...</p>;
  }

  if (error) {
    return <p className="alert error">Error: {error}</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Casos sanitarios</h2>
          <p>{openCases.length} casos abiertos de {healthCases.length} registrados</p>
        </div>
      </header>

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Total casos</span>
          <strong>{healthCases.length}</strong>
        </article>

        <article className="metric-card">
          <span>Abiertos</span>
          <strong>{openCases.length}</strong>
        </article>

        <article className="metric-card">
          <span>Cerrados</span>
          <strong>{healthCases.length - openCases.length}</strong>
        </article>

        <article className="metric-card">
          <span>EDO</span>
          <strong>
            {healthCases.filter((item) => item.enfermedad?.declaracionObligatoria).length}
          </strong>
        </article>
      </div>

      <div className="cards-list">
        {healthCases.map((healthCase) => (
          <article className="panel" key={healthCase.id}>
            <div className="animal-card-header">
              <span className="tag">
                {healthCase.estado || 'Sin estado'}
              </span>

              {healthCase.enfermedad?.declaracionObligatoria && (
                <span className="priority high">Declaración obligatoria</span>
              )}
            </div>

            <h3>{healthCase.enfermedad?.nombre || healthCase.diagnostico || 'Caso sanitario'}</h3>

            <p>
              <strong>Animal:</strong>{' '}
              {healthCase.animal?.crotal || 'Sin animal asociado'}
            </p>

            <p>
              <strong>Fecha inicio:</strong>{' '}
              {healthCase.fechaInicio
                ? new Date(healthCase.fechaInicio).toLocaleDateString()
                : 'Sin fecha'}
            </p>

            <p>
              <strong>Gravedad:</strong>{' '}
              {healthCase.gravedad || 'No indicada'}
            </p>

            {healthCase.observaciones && <p>{healthCase.observaciones}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
