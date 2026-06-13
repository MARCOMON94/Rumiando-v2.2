import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../api/apiClient';
import AnimalWatchlistButton from '../components/animal-watchlist/AnimalWatchlistButton';
import AppModal from '../components/ui/AppModal';

const FILTER_TYPES = [
  ['pen', 'Corral'],
  ['reproductiveStatus', 'Estado reproductivo'],
  ['reproductiveDuration', 'Tiempo en estado reproductivo'],
  ['penDuration', 'Tiempo en corral'],
  ['sex', 'Sexo'],
  ['births', 'Número de partos'],
  ['abortions', 'Abortos'],
  ['health', 'Evento sanitario'],
  ['vaccination', 'Vacuna'],
  ['deworming', 'Desparasitación'],
  ['registryStatus', 'Estado de registro']
];

const TIME_UNITS = [
  ['days', 'días'],
  ['weeks', 'semanas'],
  ['months', 'meses'],
  ['years', 'años']
];

function getAnimalsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.animals)) return data.animals;
  if (Array.isArray(data?.animales)) return data.animales;
  return [];
}

function getArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function lastFour(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  return clean.slice(-4) || clean || '----';
}

function daysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function durationToDays(amount, unit) {
  const value = Number(amount || 0);
  if (!value) return 0;
  if (unit === 'weeks') return value * 7;
  if (unit === 'months') return value * 30;
  if (unit === 'years') return value * 365;
  return value;
}

function addRelativeTime(amount, unit) {
  const value = Number(amount || 0);
  if (!value || value < 1) return null;
  const date = new Date();
  if (unit === 'months') {
    date.setMonth(date.getMonth() + value);
  } else if (unit === 'years') {
    date.setFullYear(date.getFullYear() + value);
  } else if (unit === 'weeks') {
    date.setDate(date.getDate() + value * 7);
  } else {
    date.setDate(date.getDate() + value);
  }
  return date;
}

function buildOptions(items, getValue) {
  return [...new Set(items.map(getValue).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

function countEventsByAnimal(events, type) {
  const counts = new Map();
  for (const event of events) {
    if (type && event.tipoEvento !== type) continue;
    const animalId = Number(event.animalId || event.animal?.id);
    if (!animalId) continue;
    counts.set(animalId, (counts.get(animalId) || 0) + 1);
  }
  return counts;
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState([]);
  const [reproductiveEvents, setReproductiveEvents] = useState([]);
  const [healthCases, setHealthCases] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [dewormings, setDewormings] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [filterAmount, setFilterAmount] = useState('30');
  const [filterUnit, setFilterUnit] = useState('days');
  const [alertAnimal, setAlertAnimal] = useState(null);
  const [alertForm, setAlertForm] = useState({
    amount: '7',
    unit: 'days',
    reason: '',
    priority: 'MEDIA'
  });
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertError, setAlertError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [
          animalsData,
          reproductiveData,
          healthData,
          vaccinationsData,
          dewormingsData
        ] = await Promise.all([
          get('/animals'),
          get('/reproductive-events'),
          get('/health-cases'),
          get('/vaccinations'),
          get('/dewormings')
        ]);

        setAnimals(getAnimalsFromResponse(animalsData));
        setReproductiveEvents(getArray(reproductiveData));
        setHealthCases(getArray(healthData));
        setVaccinations(getArray(vaccinationsData));
        setDewormings(getArray(dewormingsData));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const birthCounts = useMemo(() => countEventsByAnimal(reproductiveEvents, 'PARTO'), [reproductiveEvents]);
  const abortionCounts = useMemo(() => countEventsByAnimal(reproductiveEvents, 'ABORTO'), [reproductiveEvents]);

  const options = useMemo(() => ({
    pen: buildOptions(animals, (animal) => animal.corralActual?.nombre),
    reproductiveStatus: buildOptions(animals, (animal) => animal.estadoReproductivo?.nombre),
    sex: buildOptions(animals, (animal) => animal.sexo),
    registryStatus: buildOptions(animals, (animal) => animal.estadoRegistro),
    health: buildOptions(healthCases, (item) => item.enfermedad?.nombre || item.diagnosticoPresuntivo),
    vaccination: buildOptions(vaccinations, (item) => item.vacuna),
    deworming: buildOptions(dewormings, (item) => item.producto)
  }), [animals, dewormings, healthCases, vaccinations]);

  const filteredAnimals = useMemo(() => {
    const thresholdDays = durationToDays(filterAmount, filterUnit);
    const searchValue = normalize(search);

    return animals.filter((animal) => {
      const text = [
        animal.crotal,
        animal.numeroInterno,
        animal.especie?.nombre,
        animal.raza?.nombre,
        animal.corralActual?.nombre,
        animal.estadoReproductivo?.nombre
      ].join(' ').toLowerCase();

      if (searchValue && !text.includes(searchValue)) return false;

      if (filterType === 'pen') return animal.corralActual?.nombre === filterValue;
      if (filterType === 'reproductiveStatus') return animal.estadoReproductivo?.nombre === filterValue;
      if (filterType === 'sex') return animal.sexo === filterValue;
      if (filterType === 'registryStatus') return animal.estadoRegistro === filterValue;
      if (filterType === 'births') return (birthCounts.get(Number(animal.id)) || 0) >= Number(filterValue || 0);
      if (filterType === 'abortions') return (abortionCounts.get(Number(animal.id)) || 0) >= Number(filterValue || 0);
      if (filterType === 'reproductiveDuration') {
        return daysSince(animal.fechaEstadoReproductivoActual) >= thresholdDays;
      }
      if (filterType === 'penDuration') {
        return daysSince(animal.fechaEntradaCorralActual) >= thresholdDays;
      }
      if (filterType === 'health') {
        return healthCases.some((item) => (
          Number(item.animalId || item.animal?.id) === Number(animal.id)
          && (item.enfermedad?.nombre === filterValue || item.diagnosticoPresuntivo === filterValue)
        ));
      }
      if (filterType === 'vaccination') {
        return vaccinations.some((item) => (
          Number(item.animalId || item.animal?.id) === Number(animal.id)
          && item.vacuna === filterValue
        ));
      }
      if (filterType === 'deworming') {
        return dewormings.some((item) => (
          Number(item.animalId || item.animal?.id) === Number(animal.id)
          && item.producto === filterValue
        ));
      }

      return searchValue || filterType ? true : animal.estadoRegistro !== 'BAJA';
    });
  }, [
    abortionCounts,
    animals,
    birthCounts,
    dewormings,
    filterAmount,
    filterType,
    filterUnit,
    filterValue,
    healthCases,
    search,
    vaccinations
  ]);

  function clearFilters() {
    setSearch('');
    setFilterType('');
    setFilterValue('');
    setFilterAmount('30');
    setFilterUnit('days');
  }

  function openAlert(animal) {
    setAlertAnimal(animal);
    setAlertError('');
    setAlertForm({
      amount: '7',
      unit: 'days',
      reason: '',
      priority: 'MEDIA'
    });
  }

  async function submitAlert(event) {
    event.preventDefault();
    if (!alertAnimal || alertSaving) return;

    const targetDate = addRelativeTime(alertForm.amount, alertForm.unit);
    if (!targetDate) {
      setAlertError('Indica cuándo quieres recibir la alerta.');
      return;
    }

    setAlertSaving(true);
    setAlertError('');
    try {
      await post('/reminders', {
        tipo: `ALERTA_MANUAL_${alertForm.priority}`,
        fechaObjetivo: targetDate.toISOString(),
        origenRegla: 'PERSONALIZADO',
        nota: alertForm.reason.trim() || 'Alerta manual',
        animalId: Number(alertAnimal.id)
      });
      setAlertAnimal(null);
    } catch (err) {
      setAlertError(err.message || 'No se pudo crear la alerta.');
    } finally {
      setAlertSaving(false);
    }
  }

  function renderFilterControls() {
    if (!filterType) return null;

    if (['births', 'abortions'].includes(filterType)) {
      return (
        <label>
          Mínimo
          <input
            type="number"
            min="0"
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder="Ej. 3"
          />
        </label>
      );
    }

    if (['reproductiveDuration', 'penDuration'].includes(filterType)) {
      return (
        <div className="census-inline-filter">
          <label>
            Lleva al menos
            <input
              type="number"
              min="1"
              value={filterAmount}
              onChange={(event) => setFilterAmount(event.target.value)}
            />
          </label>
          <label>
            Tiempo
            <select value={filterUnit} onChange={(event) => setFilterUnit(event.target.value)}>
              {TIME_UNITS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    const values = options[filterType] || [];
    return (
      <label>
        Opción
        <select value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
          <option value="">Selecciona</option>
          {values.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
    );
  }

  if (loading) {
    return <p>Cargando censo...</p>;
  }

  if (error) {
    return <p className="alert error">Error: {error}</p>;
  }

  return (
    <section className="page census-page">
      <div className="filters-card census-filter-card">
        <label className="search-wide">
          Buscar
          <input
            type="search"
            placeholder="Crotal, raza, corral..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          Filtrar por
          <select
            value={filterType}
            onChange={(event) => {
              setFilterType(event.target.value);
              setFilterValue('');
            }}
          >
            <option value="">Sin filtro extra</option>
            {FILTER_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {renderFilterControls()}

        <button type="button" className="button secondary" onClick={clearFilters}>
          Limpiar
        </button>
      </div>

      <p className="results-summary">
        {filteredAnimals.length} de {animals.length} animales
      </p>

      <div className="census-list">
        {filteredAnimals.map((animal) => (
          <article className="census-row" key={animal.id}>
            <div className="census-ear-tag">
              <span>Últimos 4</span>
              <strong>{lastFour(animal.crotal)}</strong>
            </div>

            <AnimalWatchlistButton
              animalId={animal.id}
              sourceType="animal_list"
              sourceRef={`animal-${animal.id}`}
              promptReason
              label="Búsqueda"
              className="secondary census-icon-button"
              iconOnly
              showMiniLabel
              disabled={animal.estadoRegistro === 'BAJA'}
            />

            <button
              type="button"
              className="secondary census-icon-button"
              onClick={() => openAlert(animal)}
              disabled={animal.estadoRegistro === 'BAJA'}
            >
              <img src="/assets/icon-cencerro-green.png" alt="" aria-hidden="true" />
              <small>Alerta</small>
            </button>

            <Link className="button secondary census-icon-button" to={`/animals/${animal.id}`}>
              <img src="/assets/icon-listado-green.png" alt="" aria-hidden="true" />
              <small>Ficha</small>
            </Link>

            <div className="census-row-meta">
              <strong>{animal.crotal}</strong>
              <span>
                {animal.corralActual?.nombre || 'Sin corral'} · {animal.estadoReproductivo?.nombre || 'Sin estado'}
              </span>
            </div>
          </article>
        ))}
      </div>

      {filteredAnimals.length === 0 && (
        <div className="empty-state">
          <h3>Sin resultados</h3>
          <p>Ajusta el filtro o busca otro crotal.</p>
        </div>
      )}

      <AppModal
        open={Boolean(alertAnimal)}
        title="Añadir alerta"
        description={alertAnimal ? `Programa un aviso manual para ${alertAnimal.crotal}.` : ''}
        onClose={() => {
          if (!alertSaving) setAlertAnimal(null);
        }}
        modalClassName="manual-alert-modal"
      >
        <form className="manual-alert-form" onSubmit={submitAlert}>
          <div className="manual-alert-inline">
            <label>
              Número
              <input
                type="number"
                min="1"
                value={alertForm.amount}
                onChange={(event) => setAlertForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </label>
            <label>
              Tiempo
              <select
                value={alertForm.unit}
                onChange={(event) => setAlertForm((current) => ({ ...current, unit: event.target.value }))}
              >
                {TIME_UNITS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Motivo
            <textarea
              rows="3"
              value={alertForm.reason}
              onChange={(event) => setAlertForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Ej. revisar ubre, repetir ecografía..."
            />
          </label>

          <label>
            Prioridad
            <select
              value={alertForm.priority}
              onChange={(event) => setAlertForm((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </label>

          {alertError && <p className="form-error">{alertError}</p>}

          <button type="submit" disabled={alertSaving}>
            {alertSaving ? 'Añadiendo...' : 'Añadir alerta'}
          </button>
        </form>
      </AppModal>
    </section>
  );
}
