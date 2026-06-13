import { useEffect, useMemo, useState } from 'react';
import { get, post, put } from '../../api/apiClient';
import AppModal from '../ui/AppModal';

function getArray(data, key) {
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function emptyPenForm(unitId = '') {
  return {
    id: null,
    nombre: '',
    tipoFuncional: '',
    capacidad: '',
    aplicarEstadoAutomaticamente: false,
    unidadRegaId: unitId,
    estadoReproductivoSugeridoId: ''
  };
}

function countAnimalsByStatus(animals, penId) {
  const counts = {};

  for (const animal of animals) {
    if (Number(animal.corralActualId || animal.corralActual?.id) !== Number(penId)) continue;

    const name = animal.estadoReproductivo?.nombre || 'Sin estado';
    counts[name] = (counts[name] || 0) + 1;
  }

  return counts;
}

export default function PensSettingsPanel({ onBack }) {
  const [catalogs, setCatalogs] = useState({
    farmUnits: [],
    pens: [],
    reproductiveStatuses: []
  });
  const [animals, setAnimals] = useState([]);
  const [form, setForm] = useState(emptyPenForm);
  const [retireDraft, setRetireDraft] = useState(null);
  const [retireDestinationId, setRetireDestinationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filteredPensForForm = useMemo(() => {
    if (!form.unidadRegaId) return catalogs.pens;

    return catalogs.pens.filter((pen) => (
      Number(pen.unidadRegaId || pen.unidadRega?.id) === Number(form.unidadRegaId)
    ));
  }, [catalogs.pens, form.unidadRegaId]);

  const retireDestinationOptions = useMemo(() => {
    if (!retireDraft) return [];

    return catalogs.pens.filter((pen) => (
      Number(pen.id) !== Number(retireDraft.id)
      && Number(pen.unidadRegaId || pen.unidadRega?.id) === Number(retireDraft.unidadRegaId)
    ));
  }, [catalogs.pens, retireDraft]);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [catalogData, animalsData] = await Promise.all([
        get('/catalogs'),
        get('/animals?estadoRegistro=ACTIVO')
      ]);

      const nextCatalogs = {
        farmUnits: getArray(catalogData, 'farmUnits'),
        pens: getArray(catalogData, 'pens'),
        reproductiveStatuses: getArray(catalogData, 'reproductiveStatuses')
      };

      setCatalogs(nextCatalogs);
      setAnimals(Array.isArray(animalsData?.data) ? animalsData.data : []);
      setForm((current) => (
        current.unidadRegaId
          ? current
          : emptyPenForm(String(nextCatalogs.farmUnits[0]?.id || ''))
      ));
    } catch (err) {
      setError(err.message || 'Error cargando corrales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function setField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value
    }));
    setMessage('');
  }

  function editPen(pen) {
    setForm({
      id: pen.id,
      nombre: pen.nombre || '',
      tipoFuncional: pen.tipoFuncional || '',
      capacidad: pen.capacidad || '',
      aplicarEstadoAutomaticamente: pen.aplicarEstadoAutomaticamente || false,
      unidadRegaId: String(pen.unidadRegaId || pen.unidadRega?.id || ''),
      estadoReproductivoSugeridoId: pen.estadoReproductivoSugeridoId
        ? String(pen.estadoReproductivoSugeridoId)
        : ''
    });
    setMessage('');
  }

  function buildPayload() {
    return {
      nombre: form.nombre,
      tipoFuncional: form.tipoFuncional || null,
      capacidad: form.capacidad || null,
      aplicarEstadoAutomaticamente: form.aplicarEstadoAutomaticamente,
      unidadRegaId: form.unidadRegaId,
      estadoReproductivoSugeridoId: form.estadoReproductivoSugeridoId || null
    };
  }

  async function savePen(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (form.id) {
        await put(`/pens/${form.id}`, buildPayload());
      } else {
        await post('/pens', buildPayload());
      }

      setMessage(form.id ? 'Corral actualizado.' : 'Corral creado.');
      setForm(emptyPenForm(form.unidadRegaId));
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openRetirePen(pen) {
    setRetireDraft(pen);
    setRetireDestinationId('');
  }

  async function retirePen() {
    if (!retireDraft) return;

    const animalCount = animals.filter((animal) => (
      Number(animal.corralActualId || animal.corralActual?.id) === Number(retireDraft.id)
    )).length;

    if (animalCount > 0 && !retireDestinationId) {
      setError('Elige un corral destino para trasladar los animales.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await post(`/pens/${retireDraft.id}/retire`, {
        moveAnimalsToPenId: retireDestinationId || null
      });

      setMessage('Corral eliminado de uso.');
      setRetireDraft(null);
      setRetireDestinationId('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Cargando corrales...</p>;
  }

  return (
    <div className="settings-pens-panel">
      <button type="button" className="secondary settings-back-button" onClick={onBack}>
        Volver
      </button>

      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert">{message}</p>}

      <form className="settings-subform" onSubmit={savePen}>
        <label>
          Nombre
          <input
            value={form.nombre}
            onChange={(event) => setField('nombre', event.target.value)}
            required
          />
        </label>

        <label>
          REGA
          <select
            value={form.unidadRegaId}
            onChange={(event) => setField('unidadRegaId', event.target.value)}
            required
          >
            <option value="">Selecciona REGA</option>
            {catalogs.farmUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.nombre || unit.codigoRega}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo
          <input
            value={form.tipoFuncional}
            onChange={(event) => setField('tipoFuncional', event.target.value)}
            placeholder="Paridera, producción..."
          />
        </label>

        <label>
          Capacidad
          <input
            type="number"
            min="0"
            value={form.capacidad}
            onChange={(event) => setField('capacidad', event.target.value)}
          />
        </label>

        <label>
          Estado sugerido
          <select
            value={form.estadoReproductivoSugeridoId}
            onChange={(event) => setField('estadoReproductivoSugeridoId', event.target.value)}
          >
            <option value="">Sin estado sugerido</option>
            {catalogs.reproductiveStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="batch-checkbox">
          <input
            type="checkbox"
            checked={form.aplicarEstadoAutomaticamente}
            onChange={(event) => setField('aplicarEstadoAutomaticamente', event.target.checked)}
          />
          Preguntar cambio al meter animales
        </label>

        <button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : form.id ? 'Guardar corral' : 'Añadir corral'}
        </button>
      </form>

      <div className="settings-list">
        {filteredPensForForm.map((pen) => {
          const statusCounts = countAnimalsByStatus(animals, pen.id);
          const animalCount = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

          return (
            <article className="settings-list-row settings-pen-row" key={pen.id}>
              <div>
                <strong>{pen.nombre}</strong>
                <span>{animalCount} animales</span>
                {Object.entries(statusCounts).length > 0 && (
                  <small>
                    {Object.entries(statusCounts)
                      .map(([status, count]) => `${status}: ${count}`)
                      .join(' · ')}
                  </small>
                )}
              </div>
              <button type="button" className="secondary" onClick={() => editPen(pen)}>
                Editar
              </button>
              <button type="button" className="secondary" onClick={() => openRetirePen(pen)}>
                Eliminar
              </button>
            </article>
          );
        })}
      </div>

      <AppModal
        open={Boolean(retireDraft)}
        title="Eliminar corral"
        description={
          retireDraft
            ? `Si ${retireDraft.nombre} tiene animales, elige dónde trasladarlos.`
            : ''
        }
        onClose={() => setRetireDraft(null)}
      >
        {retireDestinationOptions.length > 0 && (
          <label>
            Corral destino
            <select
              value={retireDestinationId}
              onChange={(event) => setRetireDestinationId(event.target.value)}
            >
              <option value="">Sin destino</option>
              {retireDestinationOptions.map((pen) => (
                <option key={pen.id} value={pen.id}>
                  {pen.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="app-modal-footer">
          <button type="button" className="secondary" onClick={() => setRetireDraft(null)}>
            Cancelar
          </button>
          <button type="button" onClick={retirePen} disabled={saving}>
            Eliminar corral
          </button>
        </div>
      </AppModal>
    </div>
  );
}
