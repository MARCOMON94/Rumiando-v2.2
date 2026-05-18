import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api/apiClient';

function formatDate(value) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no válida';
  }

  return date.toLocaleDateString();
}

function EmptyBlock({ text }) {
  return <p className="muted">{text}</p>;
}

function InfoRow({ label, value }) {
  return (
    <p>
      <strong>{label}:</strong>{' '}
      {value || 'Sin registrar'}
    </p>
  );
}

export default function AnimalDetailPage() {
  const { id } = useParams();

  const [animal, setAnimal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAnimal() {
      if (!id || id === 'undefined' || Number.isNaN(Number(id))) {
        setError('ID de animal no válido.');
        setLoading(false);
        return;
      }

      try {
        const data = await get(`/animals/${id}`);

        const animalData =
          data.animal ||
          data.data ||
          data;

        setAnimal(animalData);
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

  const children = [
    ...(animal.hijosComoMadre || []),
    ...(animal.hijosComoPadre || [])
  ];

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ficha animal</p>
          <h2>{animal.crotal}</h2>
          <p>
            {animal.especie?.nombre || 'Sin especie'} ·{' '}
            {animal.raza?.nombre || 'Sin raza'} ·{' '}
            {animal.sexo}
          </p>
        </div>

        <Link className="button secondary" to="/animals">
          Volver al censo
        </Link>
      </header>

      <div className="metrics-grid">
        <article className="metric-card">
          <span>Estado registro</span>
          <strong>{animal.estadoRegistro}</strong>
        </article>

        <article className="metric-card">
          <span>Corral actual</span>
          <strong>{animal.corralActual?.nombre || '-'}</strong>
        </article>

        <article className="metric-card">
          <span>Estado reproductivo</span>
          <strong>{animal.estadoReproductivo?.nombre || '-'}</strong>
        </article>

        <article className="metric-card">
          <span>Casos sanitarios</span>
          <strong>{animal.casosSanitarios?.length || 0}</strong>
        </article>
      </div>

      <div className="detail-grid">
        <article className="panel">
          <h3>Identificación</h3>
          <InfoRow label="Crotal" value={animal.crotal} />
          <InfoRow label="Número interno" value={animal.numeroInterno} />
          <InfoRow label="Sexo" value={animal.sexo} />
          <InfoRow label="Fecha nacimiento" value={formatDate(animal.fechaNacimiento)} />
          <InfoRow label="Fecha entrada" value={formatDate(animal.fechaEntrada)} />
          <InfoRow label="Origen" value={animal.origen} />
          <InfoRow label="Observaciones" value={animal.observaciones} />
        </article>

        <article className="panel">
          <h3>Manejo actual</h3>
          <InfoRow label="Unidad REGA" value={animal.unidadRega?.nombre} />
          <InfoRow label="Código REGA" value={animal.unidadRega?.codigoRega} />
          <InfoRow label="Municipio" value={animal.unidadRega?.municipio} />
          <InfoRow label="Provincia" value={animal.unidadRega?.provincia} />
          <InfoRow label="Corral" value={animal.corralActual?.nombre} />
          <InfoRow label="Entrada al corral" value={formatDate(animal.fechaEntradaCorralActual)} />
        </article>

        <article className="panel">
          <h3>Reproducción</h3>
          <InfoRow label="Estado reproductivo" value={animal.estadoReproductivo?.nombre} />
          <InfoRow label="Fecha estado actual" value={formatDate(animal.fechaEstadoReproductivoActual)} />
          <p>
  <strong>Madre:</strong>{' '}
  {animal.madre?.id ? (
    <Link className="text-link inline-link" to={`/animals/${animal.madre.id}`}>
      {animal.madre.crotal}
    </Link>
  ) : (
    'No registrada'
  )}
</p>

<p>
  <strong>Padre:</strong>{' '}
  {animal.padre?.id ? (
    <Link className="text-link inline-link" to={`/animals/${animal.padre.id}`}>
      {animal.padre.crotal}
    </Link>
  ) : (
    'No registrado'
  )}
</p>

<InfoRow label="Descendencia registrada" value={String(children.length)} />
        </article>
      </div>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Eventos reproductivos</h3>
            <p>Historial reproductivo asociado al animal.</p>
          </div>
        </div>

        {animal.eventosReproductivos?.length > 0 ? (
          <div className="cards-list">
            {animal.eventosReproductivos.map((event) => (
              <article className="animal-card" key={event.id}>
                <div className="animal-card-header">
                  <span className="tag">{event.tipoEvento}</span>
                  <span>{formatDate(event.fecha)}</span>
                </div>

                <h3>{event.resultado || 'Evento reproductivo'}</h3>

                <InfoRow label="Semanas gestación" value={event.semanasGestacion} />
                <InfoRow label="Parto estimado" value={formatDate(event.fechaPartoEstimada)} />
                <InfoRow label="Crías vivas" value={event.numeroCriasVivas} />
                <InfoRow label="Crías muertas" value={event.numeroCriasMuertas} />
                <InfoRow label="Observaciones" value={event.observaciones} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyBlock text="No hay eventos reproductivos registrados." />
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Movimientos</h3>
            <p>Movimientos de corral o lote en los que aparece este animal.</p>
          </div>
        </div>

        {animal.detallesMovimiento?.length > 0 ? (
          <div className="cards-list">
            {animal.detallesMovimiento.map((detail) => (
              <article className="animal-card" key={detail.id}>
                <div className="animal-card-header">
                  <span className="tag">{detail.estadoProceso}</span>
                  <span>{formatDate(detail.createdAt)}</span>
                </div>

                <h3>{detail.transaccion?.tipoOperacion || 'Movimiento'}</h3>

                <InfoRow label="Crotal leído" value={detail.crotalLeido} />
                <InfoRow label="Origen" value={detail.corralOrigen?.nombre} />
                <InfoRow label="Destino" value={detail.corralDestino?.nombre} />
                <InfoRow label="Motivo" value={detail.transaccion?.motivo} />
                <InfoRow label="Observaciones" value={detail.observaciones} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyBlock text="No hay movimientos registrados para este animal." />
        )}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Sanidad</h3>
            <p>Casos sanitarios, tratamientos, vacunaciones y desparasitaciones.</p>
          </div>
        </div>

        <div className="detail-grid">
          <article className="panel">
            <h3>Casos sanitarios</h3>

            {animal.casosSanitarios?.length > 0 ? (
              animal.casosSanitarios.map((caseItem) => (
                <div className="compact-item" key={caseItem.id}>
                  <span className="tag">{caseItem.estado}</span>
                  <InfoRow label="Enfermedad" value={caseItem.enfermedad?.nombre} />
                  <InfoRow label="Fecha inicio" value={formatDate(caseItem.fechaInicio)} />
                  <InfoRow label="Gravedad" value={caseItem.gravedad} />
                  <InfoRow label="Diagnóstico" value={caseItem.diagnosticoConfirmado || caseItem.diagnosticoPresuntivo} />
                </div>
              ))
            ) : (
              <EmptyBlock text="Sin casos sanitarios." />
            )}
          </article>

          <article className="panel">
            <h3>Tratamientos</h3>

            {animal.tratamientos?.length > 0 ? (
              animal.tratamientos.map((treatment) => (
                <div className="compact-item" key={treatment.id}>
                  <InfoRow label="Producto" value={treatment.medicamentoProducto} />
                  <InfoRow label="Principio activo" value={treatment.principioActivo} />
                  <InfoRow label="Inicio" value={formatDate(treatment.fechaInicio)} />
                  <InfoRow label="Fin" value={formatDate(treatment.fechaFin)} />
                  <InfoRow label="Dosis" value={treatment.dosisTexto} />
                </div>
              ))
            ) : (
              <EmptyBlock text="Sin tratamientos registrados." />
            )}
          </article>

          <article className="panel">
            <h3>Vacunaciones</h3>

            {animal.vacunaciones?.length > 0 ? (
              animal.vacunaciones.map((vaccine) => (
                <div className="compact-item" key={vaccine.id}>
                  <InfoRow label="Vacuna" value={vaccine.vacuna} />
                  <InfoRow label="Fecha" value={formatDate(vaccine.fecha)} />
                  <InfoRow label="Lote" value={vaccine.loteVacuna} />
                  <InfoRow label="Revacunación prevista" value={vaccine.revacunacionPrevista ? 'Sí' : 'No'} />
                </div>
              ))
            ) : (
              <EmptyBlock text="Sin vacunaciones registradas." />
            )}
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h3>Otros registros</h3>
            <p>Desparasitaciones, recordatorios y descendencia.</p>
          </div>
        </div>

        <div className="detail-grid">
          <article className="panel">
            <h3>Desparasitaciones</h3>

            {animal.desparasitaciones?.length > 0 ? (
              animal.desparasitaciones.map((item) => (
                <div className="compact-item" key={item.id}>
                  <InfoRow label="Producto" value={item.producto} />
                  <InfoRow label="Tipo" value={item.tipo} />
                  <InfoRow label="Fecha" value={formatDate(item.fecha)} />
                  <InfoRow label="Motivo" value={item.motivo} />
                </div>
              ))
            ) : (
              <EmptyBlock text="Sin desparasitaciones registradas." />
            )}
          </article>

          <article className="panel">
            <h3>Recordatorios</h3>

            {animal.recordatorios?.length > 0 ? (
              animal.recordatorios.map((reminder) => (
                <div className="compact-item" key={reminder.id}>
                  <span className="tag">{reminder.estado}</span>
                  <InfoRow label="Tipo" value={reminder.tipo} />
                  <InfoRow label="Fecha objetivo" value={formatDate(reminder.fechaObjetivo)} />
                  <InfoRow label="Pospuesto hasta" value={formatDate(reminder.pospuestoHasta)} />
                  <InfoRow label="Nota" value={reminder.nota} />
                </div>
              ))
            ) : (
              <EmptyBlock text="Sin recordatorios registrados." />
            )}
          </article>

          <article className="panel">
            <h3>Descendencia</h3>

            {children.length > 0 ? (
              children.map((child) => (
                <div className="compact-item" key={child.id}>
                  <p>
  <strong>Crotal:</strong>{' '}
  <Link className="text-link inline-link" to={`/animals/${child.id}`}>
    {child.crotal}
  </Link>
</p>
                  <InfoRow label="Número interno" value={child.numeroInterno} />
                  <InfoRow label="Sexo" value={child.sexo} />
                  <InfoRow label="Nacimiento" value={formatDate(child.fechaNacimiento)} />
                </div>
              ))
            ) : (
              <EmptyBlock text="Sin descendencia registrada." />
            )}
          </article>
        </div>
      </section>
    </section>
  );
}