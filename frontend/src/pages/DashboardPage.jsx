import { useEffect, useMemo, useState } from 'react';
import { apiUrl, get, post } from '../api/apiClient';
import AppModal from '../components/ui/AppModal';

const DEFAULT_QUERY = {
  dataset: 'animals',
  groupBy: 'corral',
  filters: {
    unidadRegaId: '',
    corralId: '',
    estadoReproductivoId: '',
    especieId: '',
    razaId: '',
    sexo: '',
    estadoRegistro: '',
    fechaDesde: '',
    fechaHasta: '',
    tipoEvento: '',
    resultado: '',
    enfermedadId: '',
    estado: ''
  }
};

const SEX_OPTIONS = ['HEMBRA', 'MACHO', 'CASTRADO', 'DESCONOCIDO'];
const REGISTRY_STATUS_OPTIONS = ['ACTIVO', 'BAJA'];
const HEALTH_STATUS_OPTIONS = ['ABIERTO', 'CERRADO'];
const REPRODUCTIVE_EVENTS = [
  'CUBRICION',
  'INSEMINACION',
  'DIAGNOSTICO_GESTACION',
  'PARTO',
  'ABORTO',
  'SECADO',
  'BAJA_REPRODUCTIVA',
  'REVISION_REPRODUCTIVA'
];
const EVENT_RESULTS = ['POSITIVO', 'NEGATIVO', 'DUDOSO', 'NO_APLICA'];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header) {
  const match = String(header || '').match(/filename="?([^"]+)"?/i);
  return match?.[1] || `rumiando_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function farmUnitLabel(unit) {
  const suffix = [unit.especiePrincipal?.nombre, unit.razaPrincipal?.nombre].filter(Boolean).join(' · ');
  const base = unit.nombre || unit.codigoRega;
  return suffix ? `${base} (${suffix})` : base;
}

function PieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const colors = ['#3f6b4b', '#f97316', '#79b885', '#5b4a3f', '#94a3b8', '#facc15', '#0f766e'];
  const segments = data.reduce((accumulator, item, index) => {
    const dash = (item.value / total) * 100;
    return {
      offset: accumulator.offset - dash,
      items: [
        ...accumulator.items,
        {
          ...item,
          dash,
          offset: accumulator.offset,
          color: colors[index % colors.length]
        }
      ]
    };
  }, { offset: 25, items: [] }).items;

  return (
    <div className="analytics-pie">
      <svg viewBox="0 0 42 42" role="img" aria-label="Gráfico circular">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--surface-soft)" strokeWidth="7" />
        {segments.map((item) => (
          <circle
            key={item.label}
            cx="21"
            cy="21"
            r="15.915"
            fill="transparent"
            stroke={item.color}
            strokeWidth="7"
            strokeDasharray={`${item.dash} ${100 - item.dash}`}
            strokeDashoffset={item.offset}
          />
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="analytics-bars">
      {data.map((item) => (
        <div className="bar-row" key={item.label}>
          <div className="bar-row-header">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 90 - (item.value / max) * 75;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="analytics-line" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Evolución">
      <polyline points={points} fill="none" stroke="#3f6b4b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AnalyticsChart({ result }) {
  const data = result?.summary || [];
  if (data.length === 0) return <p className="muted">Sin datos para representar.</p>;
  if (result.chart?.type === 'pie') return <PieChart data={data} />;
  if (result.chart?.type === 'line') return <LineChart data={data} />;
  return <BarChart data={data} />;
}

export default function DashboardPage() {
  const [options, setOptions] = useState(null);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await get('/analytics/options');
        setOptions(data);
        const initialQuery = {
          ...DEFAULT_QUERY,
          dataset: data.datasets?.[0]?.value || DEFAULT_QUERY.dataset
        };
        setQuery(initialQuery);
        const initialResult = await post('/analytics/query', initialQuery);
        setResult(initialResult);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const availableBreeds = useMemo(() => {
    if (!query.filters.especieId) return options?.breeds || [];
    return (options?.breeds || []).filter((breed) => (
      Number(breed.especieId || breed.especie?.id) === Number(query.filters.especieId)
    ));
  }, [options?.breeds, query.filters.especieId]);

  async function runQuery(nextQuery = query) {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await post('/analytics/query', nextQuery);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setQueryField(name, value) {
    setQuery((current) => ({
      ...current,
      [name]: value
    }));
  }

  function setFilter(name, value) {
    setQuery((current) => ({
      ...current,
      filters: {
        ...current.filters,
        [name]: value,
        ...(name === 'especieId' ? { razaId: '' } : {})
      }
    }));
  }

  async function downloadExcel() {
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${apiUrl()}/analytics/export/excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo generar el Excel');
      }

      const blob = await response.blob();
      downloadBlob(blob, filenameFromDisposition(response.headers.get('content-disposition')));
      setMessage('Excel generado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function sendEmail(event) {
    event.preventDefault();
    setExporting(true);
    setError('');
    setMessage('');
    try {
      const data = await post('/analytics/export/email', {
        email,
        query
      });
      setMessage(data.sent
        ? 'Excel enviado por email.'
        : 'Excel preparado, pero el email no está configurado en este entorno.');
      setEmailOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading && !result) {
    return <p>Cargando estadísticas...</p>;
  }

  if (error && !result) {
    return <p className="alert error">Error: {error}</p>;
  }

  return (
    <section className="page analytics-page">
      <div className="analytics-toolbar">
        <button type="button" className="secondary analytics-excel-button" onClick={downloadExcel} disabled={exporting}>
          <img src="/assets/icon-excel-small-512.png" alt="" aria-hidden="true" />
          Excel
        </button>
        <button type="button" className="secondary" onClick={() => setEmailOpen(true)} disabled={exporting}>
          Enviar email
        </button>
      </div>

      <div className="filters-card analytics-filter-card">
        <label>
          Datos
          <select value={query.dataset} onChange={(event) => setQueryField('dataset', event.target.value)}>
            {(options?.datasets || []).map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          Agrupar por
          <select value={query.groupBy} onChange={(event) => setQueryField('groupBy', event.target.value)}>
            {(options?.groupBy || []).map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>

        <label>
          REGA
          <select value={query.filters.unidadRegaId} onChange={(event) => setFilter('unidadRegaId', event.target.value)}>
            <option value="">Todas</option>
            {(options?.farmUnits || []).map((unit) => (
              <option key={unit.id} value={unit.id}>{farmUnitLabel(unit)}</option>
            ))}
          </select>
        </label>

        <label>
          Corral
          <select value={query.filters.corralId} onChange={(event) => setFilter('corralId', event.target.value)}>
            <option value="">Todos</option>
            {(options?.pens || []).map((pen) => (
              <option key={pen.id} value={pen.id}>{pen.nombre}</option>
            ))}
          </select>
        </label>

        <label>
          Estado reproductivo
          <select
            value={query.filters.estadoReproductivoId}
            onChange={(event) => setFilter('estadoReproductivoId', event.target.value)}
          >
            <option value="">Todos</option>
            {(options?.reproductiveStatuses || []).map((status) => (
              <option key={status.id} value={status.id}>{status.nombre}</option>
            ))}
          </select>
        </label>

        <label>
          Especie
          <select value={query.filters.especieId} onChange={(event) => setFilter('especieId', event.target.value)}>
            <option value="">Todas</option>
            {(options?.species || []).map((species) => (
              <option key={species.id} value={species.id}>{species.nombre}</option>
            ))}
          </select>
        </label>

        <label>
          Raza
          <select value={query.filters.razaId} onChange={(event) => setFilter('razaId', event.target.value)}>
            <option value="">Todas</option>
            {availableBreeds.map((breed) => (
              <option key={breed.id} value={breed.id}>{breed.nombre}</option>
            ))}
          </select>
        </label>

        <label>
          Sexo
          <select value={query.filters.sexo} onChange={(event) => setFilter('sexo', event.target.value)}>
            <option value="">Todos</option>
            {SEX_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        <label>
          Estado registro
          <select
            value={query.filters.estadoRegistro}
            onChange={(event) => setFilter('estadoRegistro', event.target.value)}
          >
            <option value="">Todos</option>
            {REGISTRY_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>

        {query.dataset === 'reproductive' && (
          <>
            <label>
              Evento
              <select value={query.filters.tipoEvento} onChange={(event) => setFilter('tipoEvento', event.target.value)}>
                <option value="">Todos</option>
                {REPRODUCTIVE_EVENTS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Resultado
              <select value={query.filters.resultado} onChange={(event) => setFilter('resultado', event.target.value)}>
                <option value="">Todos</option>
                {EVENT_RESULTS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </>
        )}

        {query.dataset === 'health' && (
          <>
            <label>
              Enfermedad
              <select value={query.filters.enfermedadId} onChange={(event) => setFilter('enfermedadId', event.target.value)}>
                <option value="">Todas</option>
                {(options?.diseases || []).map((disease) => (
                  <option key={disease.id} value={disease.id}>{disease.nombre}</option>
                ))}
              </select>
            </label>
            <label>
              Estado
              <select value={query.filters.estado} onChange={(event) => setFilter('estado', event.target.value)}>
                <option value="">Todos</option>
                {HEALTH_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </>
        )}

        <label>
          Desde
          <input
            type="date"
            value={query.filters.fechaDesde}
            onChange={(event) => setFilter('fechaDesde', event.target.value)}
          />
        </label>

        <label>
          Hasta
          <input
            type="date"
            value={query.filters.fechaHasta}
            onChange={(event) => setFilter('fechaHasta', event.target.value)}
          />
        </label>

        <button type="button" onClick={() => runQuery()} disabled={loading}>
          {loading ? 'Calculando...' : 'Aplicar'}
        </button>
      </div>

      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert">{message}</p>}

      {result && (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <span>Total</span>
              <strong>{result.total}</strong>
            </article>
            <article className="metric-card">
              <span>Grupos</span>
              <strong>{result.summary?.length || 0}</strong>
            </article>
            <article className="metric-card">
              <span>Vista</span>
              <strong>{result.chart?.type || 'tabla'}</strong>
            </article>
          </div>

          <article className="panel analytics-chart-card">
            <h3>{result.title}</h3>
            <AnalyticsChart result={result} />
          </article>

          <article className="panel analytics-table-card">
            <h3>Datos</h3>
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Cantidad</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.summary || []).map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.value}</td>
                      <td>{row.percent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}

      <AppModal
        open={emailOpen}
        title="Enviar Excel"
        description="Se enviará un Excel con los datos filtrados actuales."
        onClose={() => {
          if (!exporting) setEmailOpen(false);
        }}
      >
        <form className="manual-alert-form" onSubmit={sendEmail}>
          <label>
            Email destino
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </label>
          <button type="submit" disabled={exporting}>
            {exporting ? 'Enviando...' : 'Enviar Excel'}
          </button>
        </form>
      </AppModal>
    </section>
  );
}
