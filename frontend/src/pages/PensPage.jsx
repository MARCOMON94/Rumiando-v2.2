import { useEffect, useState } from 'react';
import { get } from '../api/apiClient';

function getPensFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.pens)) return data.pens;
  if (Array.isArray(data.corrales)) return data.corrales;
  return [];
}

export default function PensPage() {
  const [pens, setPens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPens() {
      try {
        const data = await get('/pens');
        setPens(getPensFromResponse(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPens();
  }, []);

  if (loading) {
    return <p>Cargando corrales...</p>;
  }

  if (error) {
    return <p className="alert error">Error: {error}</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Manejo</p>
          <h2>Corrales</h2>
          <p>{pens.length} corrales registrados</p>
        </div>
      </header>

      <div className="cards-list">
        {pens.map((pen) => (
          <article className="panel" key={pen.id}>
            <div className="animal-card-header">
              <span className="tag">{pen.tipo || pen.tipoCorral || 'Corral'}</span>
              <span>{pen.activo === false ? 'Inactivo' : 'Activo'}</span>
            </div>

            <h3>{pen.nombre || pen.name}</h3>

            <p>
              <strong>Unidad REGA:</strong>{' '}
              {pen.unidadRega?.nombre || pen.unidadRega?.codigoRega || 'Sin unidad'}
            </p>

            <p>
              <strong>Estado sugerido:</strong>{' '}
              {pen.estadoReproductivoSugerido?.nombre || 'Sin estado sugerido'}
            </p>

            <p>
              <strong>Capacidad:</strong>{' '}
              {pen.capacidadMaxima || pen.capacidad || 'No definida'}
            </p>

            {pen.observaciones && <p>{pen.observaciones}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}