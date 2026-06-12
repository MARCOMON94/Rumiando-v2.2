import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { get } from '../api/apiClient';
import AnimalWatchlistButton from '../components/animal-watchlist/AnimalWatchlistButton';

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

function formatElapsedSince(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const days = Math.floor((Date.now() - date.getTime()) / 86400000);

  if (days < 0) return `en ${Math.abs(days)} días`;
  if (days === 0) return '0 días';
  if (days === 1) return '1 día';
  if (days < 49) return `${days} días`;

  const months = Math.floor(days / 30);
  const weeks = Math.floor((days % 30) / 7);

  if (days < 365) {
    const parts = [];
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
    if (weeks > 0) parts.push(`${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`);
    return parts.join(' y ') || `${Math.floor(days / 7)} semanas`;
  }

  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  const parts = [`${years} ${years === 1 ? 'año' : 'años'}`];

  if (remainingMonths > 0) {
    parts.push(`${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`);
  }

  return parts.join(' y ');
}

function formatAge(value) {
  if (!value) return 'Sin fecha de nacimiento';
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return 'Sin fecha de nacimiento';

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) {
    return `${months} meses`;
  }

  return `${years} años${months ? ` y ${months} meses` : ''}`;
}

function AnimalSummaryRow({
  id,
  label,
  value,
  time,
  expanded,
  onToggle,
  children
}) {
  return (
    <article className={`animal-summary-row ${expanded ? 'expanded' : ''}`}>
      <div className={`animal-summary-row-main ${children ? 'has-action' : ''}`}>
        <div>
          <span>{label}</span>
          <strong>{value || 'Sin registrar'}</strong>
          {time && <small>{time}</small>}
        </div>

        {children && (
          <button
            type="button"
            className="animal-summary-more-button"
            onClick={() => onToggle(id)}
            aria-expanded={expanded}
            aria-label={`Mostrar más de ${label}`}
          >
            <img src="/assets/icon-listado-green.png" alt="" aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && children && (
        <div className="animal-summary-detail">
          {children}
        </div>
      )}
    </article>
  );
}

export default function AnimalDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [animal, setAnimal] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
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
  const openCases = (animal.casosSanitarios || []).filter((item) => item.estado !== 'CERRADO');
  const activeReminders = (animal.recordatorios || []).filter((item) => item.estado !== 'COMPLETADO');
  const activeAlerts = [...openCases, ...activeReminders];
  const firstOpenCase = openCases[0];
  const firstReminder = activeReminders[0];
  const vaccinations = animal.vacunaciones || [];
  const dewormings = animal.desparasitaciones || [];
  const treatments = animal.tratamientos || [];
  const reproductiveIncidents = (animal.eventosReproductivos || []).filter((event) => (
    ['ABORTO', 'BAJA_REPRODUCTIVA', 'REVISION_REPRODUCTIVA'].includes(event.tipoEvento)
  ));
  const healthStatus = openCases.length > 0
    ? firstOpenCase?.enfermedad?.nombre || firstOpenCase?.diagnosticoConfirmado || firstOpenCase?.diagnosticoPresuntivo || `${openCases.length} caso(s) abierto(s)`
    : vaccinations.length > 0
      ? `Vacunado: ${vaccinations[0]?.vacuna || 'última vacuna registrada'}`
      : 'Sin casos abiertos';
  const healthTime = formatElapsedSince(firstOpenCase?.fechaInicio || vaccinations[0]?.fecha);
  const alertStatus = activeAlerts.length > 0
    ? firstReminder?.tipo || firstReminder?.nota || firstOpenCase?.enfermedad?.nombre || `${activeAlerts.length} activa(s)`
    : 'Sin alertas activas';
  const alertTime = formatElapsedSince(firstReminder?.fechaObjetivo || firstOpenCase?.fechaInicio);
  const partosCount = (animal.eventosReproductivos || []).filter((event) => event.tipoEvento === 'PARTO').length;
  const genealogySummary = [
    animal.madre?.crotal ? `Madre ${animal.madre.crotal}` : 'Madre no registrada',
    animal.padre?.crotal ? `Padre ${animal.padre.crotal}` : 'Padre no registrado',
    `${children.length} cría(s)`
  ].join(' · ');
  const returnTo = location.state?.returnTo;
  const currentPath = `${location.pathname}${location.search || ''}${location.hash || ''}`;

  function toggleExpandedRow(rowId) {
    setExpandedRows((current) => ({
      ...current,
      [rowId]: !current[rowId]
    }));
  }

  function closeDetail() {
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    navigate(-1);
  }

  function openBirthFlow() {
    navigate(`/birth/new/${animal.id}`, {
      state: {
        returnTo: currentPath
      }
    });
  }

  function openDischargeFlow() {
    navigate(`/animals/${animal.id}/discharge`, {
      state: {
        returnTo: currentPath
      }
    });
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>{animal.crotal}</h2>
          <p>
            {animal.especie?.nombre || 'Sin especie'} ·{' '}
            {animal.raza?.nombre || 'Sin raza'} ·{' '}
            {animal.sexo}
          </p>
        </div>

        <button type="button" className="secondary" onClick={closeDetail}>
          Cerrar ficha
        </button>
      </header>

      <section className="animal-profile-card" aria-label="Resumen del animal">
        <div className="animal-profile-top">
          <div className="animal-profile-code">
            <span>Crotal</span>
            <strong>{animal.crotal}</strong>
          </div>

          <AnimalWatchlistButton
            animalId={animal.id}
            sourceType="animal_detail"
            sourceRef={`animal-${animal.id}`}
            promptReason
            label="Búsqueda"
            className="secondary animal-profile-watch-button"
            iconOnly
            showMiniLabel
          />
        </div>

        <div className="animal-profile-main-actions">
          <div className="animal-profile-age-pill">
            <span>Edad</span>
            <strong>{formatAge(animal.fechaNacimiento)}</strong>
          </div>
          <button type="button" onClick={openBirthFlow}>
            Parto
          </button>
          <button type="button" onClick={openDischargeFlow}>
            Baja
          </button>
        </div>

        <div className="animal-summary-list">
          <AnimalSummaryRow
            id="reproductive"
            label="Estado reproductivo"
            value={animal.estadoReproductivo?.nombre || 'Sin estado'}
            time={formatElapsedSince(animal.fechaEstadoReproductivoActual)}
            expanded={false}
            onToggle={toggleExpandedRow}
          />

          <AnimalSummaryRow
            id="stats"
            label="Estadísticas"
            value={`${partosCount} parto(s)`}
            expanded={false}
            onToggle={toggleExpandedRow}
          />

          <AnimalSummaryRow
            id="genealogy"
            label="Genealogía"
            value={genealogySummary}
            expanded={Boolean(expandedRows.genealogy)}
            onToggle={toggleExpandedRow}
          >
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
            {children.length > 0 ? (
              children.map((child) => (
                <p key={child.id}>
                  <strong>Cría:</strong>{' '}
                  <Link className="text-link inline-link" to={`/animals/${child.id}`}>
                    {child.crotal}
                  </Link>
                </p>
              ))
            ) : (
              <EmptyBlock text="Sin descendencia registrada." />
            )}
          </AnimalSummaryRow>

          <AnimalSummaryRow
            id="alerts"
            label="Alertas activas"
            value={alertStatus}
            time={alertTime}
            expanded={Boolean(expandedRows.alerts)}
            onToggle={toggleExpandedRow}
          >
            {activeReminders.length > 0 && activeReminders.map((reminder) => (
              <div className="compact-item" key={`reminder-${reminder.id}`}>
                <InfoRow label="Aviso" value={reminder.tipo || reminder.nota} />
                <InfoRow label="Fecha objetivo" value={formatDate(reminder.fechaObjetivo)} />
              </div>
            ))}
            {openCases.length > 0 && openCases.map((caseItem) => (
              <div className="compact-item" key={`case-alert-${caseItem.id}`}>
                <InfoRow label="Caso abierto" value={caseItem.enfermedad?.nombre || caseItem.diagnosticoConfirmado || caseItem.diagnosticoPresuntivo} />
                <InfoRow label="Inicio" value={formatDate(caseItem.fechaInicio)} />
              </div>
            ))}
            {activeAlerts.length === 0 && <EmptyBlock text="Sin alertas activas." />}
          </AnimalSummaryRow>

          <AnimalSummaryRow
            id="health"
            label="Salud"
            value={healthStatus}
            time={healthTime}
            expanded={Boolean(expandedRows.health)}
            onToggle={toggleExpandedRow}
          >
            {openCases.map((caseItem) => (
              <div className="compact-item" key={`case-${caseItem.id}`}>
                <InfoRow label="Enfermedad" value={caseItem.enfermedad?.nombre || caseItem.diagnosticoConfirmado || caseItem.diagnosticoPresuntivo} />
                <InfoRow label="Inicio" value={formatDate(caseItem.fechaInicio)} />
                <InfoRow label="Gravedad" value={caseItem.gravedad} />
              </div>
            ))}
            {vaccinations.map((vaccine) => (
              <div className="compact-item" key={`vaccine-${vaccine.id}`}>
                <InfoRow label="Vacuna" value={vaccine.vacuna} />
                <InfoRow label="Fecha" value={formatDate(vaccine.fecha)} />
              </div>
            ))}
            {dewormings.map((item) => (
              <div className="compact-item" key={`deworming-${item.id}`}>
                <InfoRow label="Desparasitación" value={item.producto || item.tipo} />
                <InfoRow label="Fecha" value={formatDate(item.fecha)} />
              </div>
            ))}
            {treatments.map((treatment) => (
              <div className="compact-item" key={`treatment-${treatment.id}`}>
                <InfoRow label="Tratamiento" value={treatment.medicamentoProducto || treatment.principioActivo} />
                <InfoRow label="Inicio" value={formatDate(treatment.fechaInicio)} />
              </div>
            ))}
            {reproductiveIncidents.map((event) => (
              <div className="compact-item" key={`event-${event.id}`}>
                <InfoRow label="Evento" value={event.tipoEvento} />
                <InfoRow label="Fecha" value={formatDate(event.fecha)} />
              </div>
            ))}
            {!openCases.length && !vaccinations.length && !dewormings.length && !treatments.length && !reproductiveIncidents.length && (
              <EmptyBlock text="Sin registros sanitarios destacados." />
            )}
          </AnimalSummaryRow>

          <AnimalSummaryRow
            id="location"
            label="Corral"
            value={animal.corralActual?.nombre || 'Sin corral'}
            time={formatElapsedSince(animal.fechaEntradaCorralActual)}
            expanded={false}
            onToggle={toggleExpandedRow}
          />
        </div>
      </section>
    </section>
  );
}
