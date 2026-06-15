import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';
import AppModal from '../components/ui/AppModal';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function getItem(data) {
  return data?.animal || data?.data || data;
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.animals)) return data.animals;
  if (Array.isArray(data?.animales)) return data.animales;
  return [];
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizeCode(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function itemName(item) {
  return item?.nombre || item?.name || '';
}

function provisionalTag(mother, birthDate, index) {
  const cleanMother = normalizeCode(mother?.crotal || mother?.numeroInterno || '0000');
  const motherSuffix = cleanMother.slice(-4).padStart(4, '0');
  const parsedDate = birthDate ? new Date(`${birthDate}T00:00:00`) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const childNumber = (mother?.hijosComoMadre?.length || 0) + index + 1;
  return `${day}${month}${motherSuffix}${childNumber}`;
}

function defaultOffspring(mother, birthDate, index) {
  return {
    crotal: provisionalTag(mother, birthDate, index),
    crotalTouched: false,
    sexo: 'HEMBRA',
    padreId: ''
  };
}

export default function BirthNewPage() {
  const { motherId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { catalogs, loading: catalogsLoading, error: catalogsError } = useCatalogs();

  const [mother, setMother] = useState(null);
  const [males, setMales] = useState([]);
  const [birthDate] = useState(todayInput());
  const [offspringCount, setOffspringCount] = useState(1);
  const [offspring, setOffspring] = useState([]);
  const [motherDestination, setMotherDestination] = useState('paridera');
  const [offspringLocation, setOffspringLocation] = useState('paridera');
  const [placementOpen, setPlacementOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const saveInFlightRef = useRef(false);

  const returnTo = location.state?.returnTo;
  const returnMode = location.state?.returnMode;

  const farmPens = useMemo(() => {
    if (!mother?.unidadRegaId) return [];
    return catalogs.pens.filter((pen) => Number(pen.unidadRegaId) === Number(mother.unidadRegaId));
  }, [catalogs.pens, mother]);

  const lactanteStatus = useMemo(() => (
    catalogs.reproductiveStatuses.find((status) => normalizeText(itemName(status)) === 'LACTANTE')
  ), [catalogs.reproductiveStatuses]);

  const paridaStatus = useMemo(() => (
    catalogs.reproductiveStatuses.find((status) => normalizeText(itemName(status)) === 'PARIDA')
  ), [catalogs.reproductiveStatuses]);

  const parideraPen = useMemo(() => (
    farmPens.find((pen) => {
      const name = normalizeText(itemName(pen));
      return name.includes('PARIDERA') || name.includes('PARIDAS') || name.includes('LACTANCIA');
    })
  ), [farmPens]);

  const productionPen = useMemo(() => (
    farmPens.find((pen) => {
      const name = normalizeText(itemName(pen));
      return name.includes('PRODUCCION') || name.includes('PRODUCTORA');
    })
  ), [farmPens]);

  useEffect(() => {
    let ignore = false;

    async function loadMother() {
      setLoading(true);
      setError('');

      try {
        setResult(null);
        setOffspring([]);
        const rawMother = await get(`/animals/${motherId}`);
        const motherData = getItem(rawMother);

        if (!motherData?.id) {
          throw new Error('No se encontro la madre seleccionada.');
        }

        const rawMales = await get(`/animals?sexo=MACHO&unidadRegaId=${motherData.unidadRegaId}&estadoRegistro=ACTIVO`);
        const maleItems = getItems(rawMales).filter((animal) => Number(animal.id) !== Number(motherData.id));

        if (!ignore) {
          setMother(motherData);
          setMales(maleItems);
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMother();

    return () => {
      ignore = true;
    };
  }, [motherId]);

  useEffect(() => {
    if (mother && offspring.length === 0) {
      setOffspring([defaultOffspring(mother, birthDate, 0)]);
    }
  }, [birthDate, mother, offspring.length]);

  useEffect(() => {
    if (!parideraPen) {
      setMotherDestination('none');
      setOffspringLocation('mother');
    }
  }, [parideraPen]);

  function closeFlow() {
    if (returnMode === 'back') {
      navigate(-1);
      return;
    }

    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    navigate(-1);
  }

  function handleCountChange(event) {
    const nextCount = Math.max(1, Math.min(6, Number(event.target.value || 1)));
    setOffspringCount(nextCount);
    setOffspring((current) => (
      Array.from({ length: nextCount }, (_, index) => current[index] || defaultOffspring(mother, birthDate, index))
    ));
  }

  function updateOffspring(index, field, value) {
    setOffspring((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      return {
        ...item,
        [field]: value,
        crotalTouched: field === 'crotal' ? true : item.crotalTouched
      };
    }));
  }

  function offspringPenId() {
    if (offspringLocation === 'paridera' && parideraPen?.id) return Number(parideraPen.id);
    if (offspringLocation === 'mother' && mother?.corralActualId) return Number(mother.corralActualId);
    return null;
  }

  function motherDestinationPen() {
    if (motherDestination === 'paridera') return parideraPen;
    if (motherDestination === 'produccion') return productionPen;
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!mother?.id) return;

    if (!lactanteStatus?.id) {
      setError('No existe el estado reproductivo Lactante en catálogos.');
      return;
    }

    setPlacementOpen(true);
  }

  async function saveBirth() {
    if (!mother?.id || !lactanteStatus?.id || saveInFlightRef.current || result) return;

    saveInFlightRef.current = true;
    setSaving(true);
    setError('');

    try {
      const newborns = [];
      const childPenId = offspringPenId();

      for (const child of offspring) {
        const created = await post('/animals', {
          crotal: child.crotal,
          crotalDefinitivo: false,
          numeroInterno: null,
          sexo: child.sexo,
          fechaNacimiento: birthDate,
          fechaEntrada: birthDate,
          origen: 'Nacimiento en explotación',
          unidadRegaId: Number(mother.unidadRegaId),
          especieId: Number(mother.especieId),
          razaId: mother.razaId ? Number(mother.razaId) : null,
          corralActualId: childPenId,
          estadoReproductivoId: Number(lactanteStatus.id),
          madreId: Number(mother.id),
          padreId: child.padreId ? Number(child.padreId) : null,
          observaciones: 'Alta creada desde flujo de parto.'
        });
        newborns.push(getItem(created));
      }

      await post('/reproductive-events', {
        tipoEvento: 'PARTO',
        resultado: 'POSITIVO',
        fecha: birthDate,
        animalId: Number(mother.id),
        estadoResultanteId: paridaStatus?.id ? Number(paridaStatus.id) : null,
        numeroCriasVivas: newborns.length,
        numeroCriasMuertas: 0,
        observaciones: `Parto registrado desde flujo móvil. Crías: ${newborns.map((item) => item.crotal).join(', ')}.`
      });

      const destinationPen = motherDestinationPen();
      if (destinationPen?.id && mother.crotal) {
        await post('/movements', {
          tipoOperacion: 'INDIVIDUAL',
          motivo: 'Movimiento tras parto',
          fecha: birthDate,
          unidadRegaId: Number(mother.unidadRegaId),
          corralDestinoId: Number(destinationPen.id),
          crotales: [mother.crotal],
          aplicarEstadoReproductivo: Boolean(destinationPen.aplicarEstadoAutomaticamente && destinationPen.estadoReproductivoSugeridoId),
          estadoReproductivoDestinoId: destinationPen.estadoReproductivoSugeridoId
            ? Number(destinationPen.estadoReproductivoSugeridoId)
            : null
        });
      }

      setResult({
        newborns,
        message: `Parto registrado con ${newborns.length} cría(s).`
      });
      setPlacementOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (loading || catalogsLoading) return <p>Cargando parto...</p>;
  if (catalogsError) return <p className="alert error">Error catálogos: {catalogsError}</p>;
  if (error && !mother) return <p className="alert error">Error: {error}</p>;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>{mother?.crotal}</h2>
          <p>Registra crías nuevas a partir de la madre leída.</p>
        </div>

        <button type="button" className="secondary" onClick={closeFlow}>
          Cerrar
        </button>
      </header>

      {result ? (
        <section className="form-card">
          <h3>{result.message}</h3>
          <p className="muted">
            Madre: {mother.crotal}. Crías: {result.newborns.map((item) => item.crotal).join(', ')}.
          </p>
          <div className="form-actions">
            <button type="button" onClick={closeFlow}>
              Finalizar
            </button>
            <Link className="button secondary" to={`/animals/${result.newborns[0]?.id}`}>
              Ver primera cría
            </Link>
          </div>
        </section>
      ) : (
        <form className="form-card wide-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Número de crías
              <input
                type="number"
                min="1"
                max="6"
                value={offspringCount}
                onChange={handleCountChange}
                required
              />
            </label>
          </div>

          <div className="birth-offspring-list">
            {offspring.map((child, index) => (
              <fieldset className="birth-offspring-card" key={`offspring-${index + 1}`}>
                <legend>Cría {index + 1}</legend>

                <div className="form-grid">
                  <label>
                    Crotal provisional
                    <input
                      value={child.crotal}
                      onChange={(event) => updateOffspring(index, 'crotal', event.target.value)}
                      required
                    />
                  </label>

                  <label>
                    Sexo
                    <select
                      value={child.sexo}
                      onChange={(event) => updateOffspring(index, 'sexo', event.target.value)}
                    >
                      <option value="HEMBRA">Hembra</option>
                      <option value="MACHO">Macho</option>
                      <option value="CASTRADO">Castrado</option>
                      <option value="DESCONOCIDO">Desconocido</option>
                    </select>
                  </label>

                  <label>
                    Padre
                    <select
                      value={child.padreId}
                      onChange={(event) => updateOffspring(index, 'padreId', event.target.value)}
                    >
                      <option value="">Sin indicar</option>
                      {males.map((male) => (
                        <option key={male.id} value={male.id}>
                          {male.crotal || male.numeroInterno}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            ))}
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar'}
            </button>

            <button type="button" className="secondary" onClick={closeFlow}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <AppModal
        open={placementOpen}
        title="Finalizar parto"
        description="Confirma dónde quedan las crías y si movemos a la madre al cerrar."
        onClose={() => {
          if (!saving) setPlacementOpen(false);
        }}
      >
        <label>
          Corral de crías
          <select value={offspringLocation} onChange={(event) => setOffspringLocation(event.target.value)}>
            {parideraPen && <option value="paridera">Paridera</option>}
            <option value="mother">Corral actual de la madre</option>
            <option value="none">Sin corral</option>
          </select>
        </label>

        <label>
          Madre al finalizar
          <select value={motherDestination} onChange={(event) => setMotherDestination(event.target.value)}>
            <option value="none">No mover</option>
            {parideraPen && <option value="paridera">Paridera</option>}
            {productionPen && <option value="produccion">Producción</option>}
          </select>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            onClick={() => setPlacementOpen(false)}
            disabled={saving}
          >
            Volver
          </button>
          <button type="button" onClick={saveBirth} disabled={saving}>
            {saving ? 'Registrando...' : 'Finalizar'}
          </button>
        </div>
      </AppModal>
    </section>
  );
}
