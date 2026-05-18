import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/apiClient';

function getAnimalsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.animals)) return data.animals;
  if (Array.isArray(data.animales)) return data.animales;
  return [];
}

export default function AnimalsPage() {
  const [animals, setAnimals] = useState([]);
  const [search, setSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('');
  const [sexFilter, setSexFilter] = useState('');
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
    const values = animals
      .map((animal) => animal.especie?.nombre)
      .filter(Boolean);

    return [...new Set(values)];
  }, [animals]);

  const filteredAnimals = useMemo(() => {
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

      const matchesSearch = searchText.includes(search.toLowerCase());
      const matchesSpecies = !speciesFilter || animal.especie?.nombre === speciesFilter;
      const matchesSex = !sexFilter || animal.sexo === sexFilter;

      return matchesSearch && matchesSpecies && matchesSex;
    });
  }, [animals, search, speciesFilter, sexFilter]);

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
          <p>{filteredAnimals.length} animales visibles de {animals.length}</p>
        </div>

        <Link className="button" to="/animals/new">
          Registrar animal
        </Link>
      </header>

      <div className="filters-card">
        <input
          type="search"
          placeholder="Buscar por crotal, raza, corral..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={speciesFilter}
          onChange={(event) => setSpeciesFilter(event.target.value)}
        >
          <option value="">Todas las especies</option>
          {speciesOptions.map((species) => (
            <option key={species} value={species}>
              {species}
            </option>
          ))}
        </select>

        <select
          value={sexFilter}
          onChange={(event) => setSexFilter(event.target.value)}
        >
          <option value="">Todos los sexos</option>
          <option value="HEMBRA">Hembra</option>
          <option value="MACHO">Macho</option>
          <option value="CASTRADO">Castrado</option>
          <option value="DESCONOCIDO">Desconocido</option>
        </select>
      </div>

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
    </section>
  );
}