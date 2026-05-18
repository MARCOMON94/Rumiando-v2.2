import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get } from '../api/apiClient';

function getAnimalsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.animals)) return data.animals;
  if (Array.isArray(data?.animales)) return data.animales;
  return [];
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export default function AnimalsPage() {
  const navigate = useNavigate();

  const [animals, setAnimals] = useState([]);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
  const [penFilter, setPenFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [autoOpenedCrotal, setAutoOpenedCrotal] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAnimals() {
      try {
        const data = await get('/animals');
        setAnimals(getAnimalsFromResponse(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAnimals();
  }, []);

  const speciesOptions = useMemo(() => {
    return [...new Set(animals.map((animal) => animal.especie?.nombre).filter(Boolean))];
  }, [animals]);

  const penOptions = useMemo(() => {
    return [...new Set(animals.map((animal) => animal.corralActual?.nombre).filter(Boolean))];
  }, [animals]);

  const statusOptions = useMemo(() => {
    return [...new Set(animals.map((animal) => animal.estadoReproductivo?.nombre).filter(Boolean))];
  }, [animals]);

  const hasActiveSearch = Boolean(
    search.trim() ||
    speciesFilter ||
    sexFilter ||
    penFilter ||
    statusFilter
  );

  const filteredAnimals = useMemo(() => {
    if (!hasActiveSearch) {
      return [];
    }

    return animals.filter((animal) => {
      const searchText = [
        animal.crotal,
        animal.numeroInterno,
        animal.especie?.nombre,
        animal.raza?.nombre,
        animal.corralActual?.nombre,
        animal.estadoReproductivo?.nombre
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !search.trim() || searchText.includes(normalize(search));
      const matchesSpecies = !speciesFilter || animal.especie?.nombre === speciesFilter;
      const matchesSex = !sexFilter || animal.sexo === sexFilter;
      const matchesPen = !penFilter || animal.corralActual?.nombre === penFilter;
      const matchesStatus = !statusFilter || animal.estadoReproductivo?.nombre === statusFilter;

      return matchesSearch && matchesSpecies && matchesSex && matchesPen && matchesStatus;
    });
  }, [animals, search, speciesFilter, sexFilter, penFilter, statusFilter, hasActiveSearch]);

  useEffect(() => {
    const cleanSearch = normalize(search);

    if (!cleanSearch || cleanSearch === normalize(autoOpenedCrotal)) {
      return;
    }

    const exactMatch = animals.find((animal) => {
      return normalize(animal.crotal) === cleanSearch;
    });

    if (exactMatch) {
      setAutoOpenedCrotal(exactMatch.crotal);
      navigate(`/animals/${exactMatch.id}`);
    }
  }, [search, animals, navigate, autoOpenedCrotal]);

  function clearFilters() {
    setSearch('');
    setSpeciesFilter('');
    setSexFilter('');
    setPenFilter('');
    setStatusFilter('');
    setAutoOpenedCrotal('');
  }

  if (loading) {
    return <p>Cargando animales...</p>;
  }

  if (error) {
    return <p className="alert error">Error: {error}</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Censo animal</p>
          <h2>Animales</h2>
          <p>
            Busca por crotal, número interno, raza, corral o estado. Si el crotal coincide exactamente,
            se abre la ficha automáticamente.
          </p>
        </div>

        <Link className="button" to="/animals/new">
          Registrar animal
        </Link>
      </header>

      <div className="filters-card animals-search-panel">
        <label className="search-wide">
          Buscar animal
          <input
            type="search"
            placeholder="Pega o escribe un crotal..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        </label>

        <label>
          Especie
          <select
            value={speciesFilter}
            onChange={(event) => setSpeciesFilter(event.target.value)}
          >
            <option value="">Todas</option>
            {speciesOptions.map((species) => (
              <option key={species} value={species}>{species}</option>
            ))}
          </select>
        </label>

        <label>
          Sexo
          <select
            value={sexFilter}
            onChange={(event) => setSexFilter(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="HEMBRA">Hembra</option>
            <option value="MACHO">Macho</option>
            <option value="CASTRADO">Castrado</option>
            <option value="DESCONOCIDO">Desconocido</option>
          </select>
        </label>

        <label>
          Corral
          <select
            value={penFilter}
            onChange={(event) => setPenFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {penOptions.map((pen) => (
              <option key={pen} value={pen}>{pen}</option>
            ))}
          </select>
        </label>

        <label>
          Estado reproductivo
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>

        <button type="button" className="button secondary" onClick={clearFilters}>
          Limpiar
        </button>
      </div>

      {!hasActiveSearch && (
        <div className="empty-state">
          <h3>No se muestran animales de entrada</h3>
          <p>
            Usa el buscador o los filtros para localizar animales. Esto evita cargar visualmente
            todo el censo y permite trabajar pegando crotales desde un lector.
          </p>
        </div>
      )}

      {hasActiveSearch && filteredAnimals.length === 0 && (
        <div className="empty-state">
          <h3>No hay coincidencias</h3>
          <p>Prueba con otro crotal, raza, corral o estado.</p>
        </div>
      )}

      {hasActiveSearch && filteredAnimals.length > 0 && (
        <>
          <p className="results-summary">
            {filteredAnimals.length} resultado(s) de {animals.length} animales registrados.
          </p>

          <div className="animals-grid">
            {filteredAnimals.map((animal) => (
              <article className="animal-card" key={animal.id}>
                <div className="animal-card-header">
                  <span className="tag">{animal.especie?.nombre || 'Sin especie'}</span>
                  <span>{animal.sexo}</span>
                </div>

                <h3>{animal.crotal}</h3>

                <dl>
                  <div>
                    <dt>Raza</dt>
                    <dd>{animal.raza?.nombre || 'Sin raza'}</dd>
                  </div>

                  <div>
                    <dt>Corral</dt>
                    <dd>{animal.corralActual?.nombre || 'Sin corral'}</dd>
                  </div>

                  <div>
                    <dt>Estado reproductivo</dt>
                    <dd>{animal.estadoReproductivo?.nombre || 'Sin estado'}</dd>
                  </div>
                </dl>

                <Link className="text-link" to={`/animals/${animal.id}`}>
                  Ver ficha
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}