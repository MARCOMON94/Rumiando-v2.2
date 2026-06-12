import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../api/apiClient';

function getMovementsFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.movements)) return data.movements;
  if (Array.isArray(data?.movimientos)) return data.movimientos;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no válida';
  }

  return date.toLocaleDateString();
}

export default function MovementsPage() {
  const [movements, setMovements] = useState([]);
  const [rawResponse, setRawResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMovements() {
      try {
        const data = await get('/movements');

        console.log('Respuesta /movements:', data);

        setRawResponse(data);
        setMovements(getMovementsFromResponse(data));
      } catch (err) {
        console.error('Error cargando movimientos:', err);
        setError(err.message || 'Error cargando movimientos');
      } finally {
        setLoading(false);
      }
    }

    loadMovements();
  }, []);

  if (loading) {
    return (
      <section className="page">
        <p>Cargando movimientos...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page">
        <header className="page-header">
  <div>
    <h2>Movimientos</h2>
    <p>{movements.length} movimientos registrados</p>
  </div>

  <Link className="button" to="/movements/new">
    Registrar movimiento
  </Link>
</header>

        <p className="alert error">Error: {error}</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Movimientos</h2>
          <p>{movements.length} movimientos registrados</p>
        </div>
      </header>

      {movements.length === 0 && (
        <div className="panel">
          <h3>No hay movimientos para mostrar</h3>
          <p>
            La API ha respondido correctamente, pero no se han encontrado movimientos
            en el formato esperado.
          </p>

          <h4>Respuesta recibida</h4>
          <pre>{JSON.stringify(rawResponse, null, 2)}</pre>
        </div>
      )}

      {movements.length > 0 && (
        <div className="cards-list">
          {movements.map((movement) => {
            const details =
              movement.detalles ||
              movement.detallesMovimiento ||
              movement.movimientoAnimalDetalles ||
              movement.animales ||
              [];

            return (
              <article className="panel" key={movement.id}>
                <div className="animal-card-header">
                  <span className="tag">
                    {movement.tipoOperacion || movement.tipo || 'Movimiento'}
                  </span>

                  <span>
                    {formatDate(movement.fecha || movement.createdAt)}
                  </span>
                </div>

                <h3>{movement.motivo || movement.resumen || 'Movimiento de animales'}</h3>

                <p>
                  <strong>Origen:</strong>{' '}
                  {movement.corralOrigen?.nombre ||
                    movement.origen?.nombre ||
                    'Sin origen'}
                </p>

                <p>
                  <strong>Destino:</strong>{' '}
                  {movement.corralDestino?.nombre ||
                    movement.destino?.nombre ||
                    'Sin destino'}
                </p>

                <p>
                  <strong>Animales procesados:</strong>{' '}
                  {Array.isArray(details)
                    ? details.length
                    : movement._count?.detalles || 'No indicado'}
                </p>

                {movement.observaciones && <p>{movement.observaciones}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
