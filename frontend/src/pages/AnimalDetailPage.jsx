
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api/apiClient';

export default function AnimalDetailPage() {
  const { id } = useParams();

  const [animal, setAnimal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAnimal() {
      try {
        const data = await get(`/animals/${id}`);
        setAnimal(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadAnimal();
  }, [id]);

  if (loading) return <p>Cargando ficha...</p>;
  if (error) return <p className="alert error">Error: {error}</p>;
  if (!animal) return <p>No se encontró el animal.</p>;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ficha animal</p>
          <h2>{animal.crotal}</h2>
          <p>{animal.especie?.nombre} · {animal.raza?.nombre}</p>
        </div>

        <Link className="button secondary" to="/animals">
          Volver
        </Link>
      </header>

      <div className="detail-grid">
        <article className="panel">
          <h3>Identificación</h3>
          <p><strong>Crotal:</strong> {animal.crotal}</p>
          <p><strong>Número interno:</strong> {animal.numeroInterno || 'Sin registrar'}</p>
          <p><strong>Sexo:</strong> {animal.sexo}</p>
          <p><strong>Estado:</strong> {animal.estadoRegistro}</p>
        </article>

        <article className="panel">
          <h3>Manejo actual</h3>
          <p><strong>Unidad REGA:</strong> {animal.unidadRega?.nombre || 'Sin REGA'}</p>
          <p><strong>Corral:</strong> {animal.corralActual?.nombre || 'Sin corral'}</p>
          <p><strong>Estado reproductivo:</strong> {animal.estadoReproductivo?.nombre || 'Sin estado'}</p>
        </article>

        <article className="panel">
          <h3>Genealogía</h3>
          <p><strong>Madre:</strong> {animal.madre?.crotal || 'No registrada'}</p>
          <p><strong>Padre:</strong> {animal.padre?.crotal || 'No registrado'}</p>
        </article>
      </div>

      <div className="panel">
        <h3>Datos completos recibidos</h3>
        <pre>{JSON.stringify(animal, null, 2)}</pre>
      </div>
    </section>
  );
}