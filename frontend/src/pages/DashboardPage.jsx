import { useEffect, useMemo, useState } from 'react';
import { get } from '../api/apiClient';

function getAnimalsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.animals)) return data.animals;
  return [];
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || 'Sin dato';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toChartData(grouped) {
  return Object.entries(grouped)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function MiniBarChart({ title, items, total }) {
  const safeTotal = total || 1;

  return (
    <article className="panel">
      <h3>{title}</h3>

      <div className="bar-list">
        {items.length === 0 && <p className="muted">Sin datos.</p>}

        {items.map((item) => (
          <div className="bar-row" key={item.label}>
            <div className="bar-row-header">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>

            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${Math.max((item.value / safeTotal) * 100, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [healthCases, setHealthCases] = useState([]);
  const [movements, setMovements] = useState([]);
  const [reminders, setReminders] = useState([]);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          dashboardData,
          animalsData,
          healthData,
          movementsData,
          remindersData
        ] = await Promise.all([
          get('/dashboard'),
          get('/animals'),
          get('/health-cases'),
          get('/movements'),
          get('/reminders?pending=true')
        ]);

        setDashboard(dashboardData);
        setAnimals(getAnimalsFromResponse(animalsData));
        setHealthCases(Array.isArray(healthData?.data) ? healthData.data : []);
        setMovements(Array.isArray(movementsData?.data) ? movementsData.data : []);
        setReminders(Array.isArray(remindersData?.data) ? remindersData.data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const activeAnimals = animals.filter((animal) => animal.estadoRegistro === 'ACTIVO');
  const females = animals.filter((animal) => animal.sexo === 'HEMBRA');
  const males = animals.filter((animal) => animal.sexo === 'MACHO');
  const openHealthCases = healthCases.filter((item) => item.estado === 'ABIERTO');

  const speciesChart = useMemo(() => {
    return toChartData(groupBy(animals, (animal) => animal.especie?.nombre));
  }, [animals]);

  const penChart = useMemo(() => {
    return toChartData(groupBy(animals, (animal) => animal.corralActual?.nombre)).slice(0, 8);
  }, [animals]);

  const reproductiveChart = useMemo(() => {
    return toChartData(groupBy(animals, (animal) => animal.estadoReproductivo?.nombre)).slice(0, 8);
  }, [animals]);

  const healthByPen = useMemo(() => {
    return toChartData(groupBy(openHealthCases, (healthCase) => {
      return healthCase.animal?.corralActual?.nombre || healthCase.corral?.nombre;
    })).slice(0, 8);
  }, [openHealthCases]);

  if (loading) {
    return <p>Cargando dashboard...</p>;
  }

  if (error) {
    return <p className="alert error">Error: {error}</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Resumen general</p>
          <h2>Dashboard</h2>
          <p>Estado operativo de la explotación a partir de datos reales del backend.</p>
        </div>
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

        <article className="metric-card">
          <span>Casos sanitarios abiertos</span>
          <strong>{openHealthCases.length}</strong>
        </article>

        <article className="metric-card">
          <span>Recordatorios pendientes</span>
          <strong>{reminders.length}</strong>
        </article>

        <article className="metric-card">
          <span>Movimientos registrados</span>
          <strong>{movements.length}</strong>
        </article>

        <article className="metric-card">
          <span>Corrales</span>
          <strong>{dashboard?.totals?.totalPens || '-'}</strong>
        </article>
      </div>

      <div className="dashboard-grid">
        <MiniBarChart
          title="Animales por especie"
          items={speciesChart}
          total={animals.length}
        />

        <MiniBarChart
          title="Animales por corral"
          items={penChart}
          total={animals.length}
        />

        <MiniBarChart
          title="Estado reproductivo"
          items={reproductiveChart}
          total={animals.length}
        />

        <MiniBarChart
          title="Casos sanitarios abiertos por corral"
          items={healthByPen}
          total={openHealthCases.length}
        />
      </div>
    </section>
  );
}