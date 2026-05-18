
import { useEffect, useState } from 'react';
import { get } from '../api/apiClient';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [dashboardData, animalsData] = await Promise.all([
          get('/dashboard'),
          get('/animals')
        ]);

        setDashboard(dashboardData);
        setAnimals(Array.isArray(animalsData) ? animalsData : animalsData.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <p>Cargando dashboard...</p>;
  }

  if (error) {
    return <p className="alert error">Error: {error}</p>;
  }

  const activeAnimals = animals.filter((animal) => animal.estadoRegistro === 'ACTIVO');
  const females = animals.filter((animal) => animal.sexo === 'HEMBRA');
  const males = animals.filter((animal) => animal.sexo === 'MACHO');

  return (
    <section className="page">
     <header className="page-header">
  <div>
    <p className="eyebrow">Censo animal</p>
    <h2>Animales</h2>
    <p>{filteredAnimals.length} animales visibles de {animals.length}</p>
  </div>

  <Link className="button" to="/animals/new">
    Registrar animal
  </Link>
</header>

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Total animales</span>
          <strong>{animals.length}</strong>
        </article>

        <article className="metric-card">
          <span>Activos</span>
          <strong>{activeAnimals.length}</strong>
        </article>

        <article className="metric-card">
          <span>Hembras</span>
          <strong>{females.length}</strong>
        </article>

        <article className="metric-card">
          <span>Machos</span>
          <strong>{males.length}</strong>
        </article>
      </div>

      <div className="panel">
        <h3>Respuesta del endpoint dashboard</h3>
        <pre>{JSON.stringify(dashboard, null, 2)}</pre>
      </div>
    </section>
  );
}