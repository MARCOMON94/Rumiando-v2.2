import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';

export default function CreateAnimalPage() {
  const navigate = useNavigate();
  const { catalogs, loading: loadingCatalogs, error: catalogsError } = useCatalogs();

  const [formData, setFormData] = useState({
    crotal: '',
    numeroInterno: '',
    sexo: 'HEMBRA',
    fechaNacimiento: '',
    fechaEntrada: '',
    origen: 'Nacimiento en explotación',
    unidadRegaId: '',
    especieId: '',
    razaId: '',
    corralActualId: '',
    estadoReproductivoId: '',
    observaciones: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredBreeds = useMemo(() => {
    if (!formData.especieId) {
      return catalogs.breeds;
    }

    return catalogs.breeds.filter((breed) => {
      return Number(breed.especieId) === Number(formData.especieId);
    });
  }, [catalogs.breeds, formData.especieId]);

  const filteredPens = useMemo(() => {
    if (!formData.unidadRegaId) {
      return catalogs.pens;
    }

    return catalogs.pens.filter((pen) => {
      return Number(pen.unidadRegaId) === Number(formData.unidadRegaId);
    });
  }, [catalogs.pens, formData.unidadRegaId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  }

  function buildPayload() {
    return {
      crotal: formData.crotal,
      numeroInterno: formData.numeroInterno || null,
      sexo: formData.sexo,
      fechaNacimiento: formData.fechaNacimiento || null,
      fechaEntrada: formData.fechaEntrada || null,
      origen: formData.origen || null,
      unidadRegaId: Number(formData.unidadRegaId),
      especieId: Number(formData.especieId),
      razaId: formData.razaId ? Number(formData.razaId) : null,
      corralActualId: formData.corralActualId ? Number(formData.corralActualId) : null,
      estadoReproductivoId: formData.estadoReproductivoId
        ? Number(formData.estadoReproductivoId)
        : null,
      observaciones: formData.observaciones || null
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const createdAnimal = await post('/animals', buildPayload());
      navigate(`/animals/${createdAnimal.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingCatalogs) {
    return <p>Cargando catálogos...</p>;
  }

  if (catalogsError) {
    return <p className="alert error">Error cargando catálogos: {catalogsError}</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Alta de animal</p>
          <h2>Registrar nuevo animal</h2>
          <p>Formulario controlado conectado a la API real de RumiAndo.</p>
        </div>

        <Link className="button secondary" to="/animals">
          Volver al censo
        </Link>
      </header>

      <form className="form-card wide-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Crotal *
            <input
              name="crotal"
              value={formData.crotal}
              onChange={handleChange}
              placeholder="Ej: ESCAPMAJ999"
              required
            />
          </label>

          <label>
            Número interno
            <input
              name="numeroInterno"
              value={formData.numeroInterno}
              onChange={handleChange}
              placeholder="Ej: CAP-999"
            />
          </label>

          <label>
            Sexo *
            <select name="sexo" value={formData.sexo} onChange={handleChange} required>
              <option value="HEMBRA">Hembra</option>
              <option value="MACHO">Macho</option>
              <option value="CASTRADO">Castrado</option>
              <option value="DESCONOCIDO">Desconocido</option>
            </select>
          </label>

          <label>
            Fecha de nacimiento
            <input
              type="date"
              name="fechaNacimiento"
              value={formData.fechaNacimiento}
              onChange={handleChange}
            />
          </label>

          <label>
            Fecha de entrada
            <input
              type="date"
              name="fechaEntrada"
              value={formData.fechaEntrada}
              onChange={handleChange}
            />
          </label>

          <label>
            Origen
            <select name="origen" value={formData.origen} onChange={handleChange}>
              <option value="Nacimiento en explotación">Nacimiento en explotación</option>
              <option value="Compra de animal">Compra de animal</option>
              <option value="Cesión / traslado">Cesión / traslado</option>
              <option value="Otro">Otro</option>
            </select>
          </label>

          <label>
            Unidad REGA *
            <select
              name="unidadRegaId"
              value={formData.unidadRegaId}
              onChange={handleChange}
              required
            >
              <option value="">Selecciona unidad</option>
              {catalogs.farmUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.nombre || unit.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Especie *
            <select
              name="especieId"
              value={formData.especieId}
              onChange={handleChange}
              required
            >
              <option value="">Selecciona especie</option>
              {catalogs.species.map((species) => (
                <option key={species.id} value={species.id}>
                  {species.nombre || species.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Raza
            <select name="razaId" value={formData.razaId} onChange={handleChange}>
              <option value="">Sin raza</option>
              {filteredBreeds.map((breed) => (
                <option key={breed.id} value={breed.id}>
                  {breed.nombre || breed.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Corral actual
            <select
              name="corralActualId"
              value={formData.corralActualId}
              onChange={handleChange}
            >
              <option value="">Sin corral</option>
              {filteredPens.map((pen) => (
                <option key={pen.id} value={pen.id}>
                  {pen.nombre || pen.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Estado reproductivo
            <select
              name="estadoReproductivoId"
              value={formData.estadoReproductivoId}
              onChange={handleChange}
            >
              <option value="">Sin estado</option>
              {catalogs.reproductiveStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.nombre || status.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Observaciones
          <textarea
            name="observaciones"
            value={formData.observaciones}
            onChange={handleChange}
            rows="4"
            placeholder="Observaciones internas del animal"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Crear animal'}
          </button>

          <Link className="button secondary" to="/animals">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}