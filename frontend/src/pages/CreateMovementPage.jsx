import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api/apiClient';
import AnimalReaderPanel from '../components/reader/AnimalReaderPanel';
import { useCatalogs } from '../context/CatalogsContext';

export default function CreateMovementPage() {
  const navigate = useNavigate();
  const { catalogs, loading: loadingCatalogs, error: catalogsError } = useCatalogs();

  const [formData, setFormData] = useState({
    tipoOperacion: 'LOTE',
    motivo: 'Movimiento de manejo',
    fecha: '',
    unidadRegaId: '',
    corralDestinoId: ''
  });
  const [readerDraft, setReaderDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  function getCrotales() {
    if (!readerDraft) {
      return [];
    }

    const animalCodes = readerDraft.animals
      .map((animal) => animal.crotal || animal.numeroInterno)
      .filter(Boolean);
    const unknownCodes = readerDraft.unknownCodes.map((item) => item.code);

    return [...new Set([...animalCodes, ...unknownCodes])];
  }

  function operationTypeFromReaderMode() {
    if (readerDraft?.mode === 'unitario') return 'INDIVIDUAL';
    if (readerDraft?.mode === 'corral') return 'CORRAL_COMPLETO';
    if (readerDraft?.mode === 'lote') return 'LOTE';
    return formData.tipoOperacion;
  }

  function buildPayload() {
    return {
      tipoOperacion: operationTypeFromReaderMode(),
      motivo: formData.motivo || null,
      fecha: formData.fecha || null,
      unidadRegaId: Number(formData.unidadRegaId),
      corralDestinoId: Number(formData.corralDestinoId),
      crotales: getCrotales()
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const crotales = getCrotales();

      if (crotales.length === 0) {
        throw new Error('Debes leer o seleccionar al menos un crotal.');
      }

      const createdMovement = await post('/movements', buildPayload());

      if (!createdMovement?.id) {
        throw new Error('El movimiento se creo, pero no se recibio un id valido.');
      }

      navigate('/movements');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingCatalogs) {
    return <p>Cargando catalogos...</p>;
  }

  if (catalogsError) {
    return <p className="alert error">Error cargando catalogos: {catalogsError}</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Movimiento de animales</p>
          <h2>Registrar movimiento</h2>
          <p>Registra un movimiento individual, en lote o por corral completo.</p>
        </div>

        <Link className="button secondary" to="/movements">
          Volver a movimientos
        </Link>
      </header>

      <form className="form-card wide-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Tipo de operacion *
            <select
              name="tipoOperacion"
              value={formData.tipoOperacion}
              onChange={handleChange}
              required
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="LOTE">Lote</option>
              <option value="CORRAL_COMPLETO">Corral completo</option>
            </select>
          </label>

          <label>
            Motivo
            <input
              name="motivo"
              value={formData.motivo}
              onChange={handleChange}
              placeholder="Ej: Paso a gestantes"
            />
          </label>

          <label>
            Fecha
            <input
              type="date"
              name="fecha"
              value={formData.fecha}
              onChange={handleChange}
            />
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
                  {unit.nombre || unit.name || unit.codigoRega}
                </option>
              ))}
            </select>
          </label>

          <label>
            Corral destino *
            <select
              name="corralDestinoId"
              value={formData.corralDestinoId}
              onChange={handleChange}
              required
            >
              <option value="">Selecciona corral</option>
              {filteredPens.map((pen) => (
                <option key={pen.id} value={pen.id}>
                  {pen.nombre || pen.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AnimalReaderPanel
          title="Seleccionar animales"
          subtitle="Usa el lector en unitario, lote o corral completo. Los repetidos se ignoran."
          initialMode={formData.tipoOperacion === 'INDIVIDUAL' ? 'unitario' : 'lote'}
          onFinish={setReaderDraft}
        />

        <div className="panel">
          <h3>Vista previa</h3>
          <p>
            Se enviaran <strong>{getCrotales().length}</strong> crotales al backend.
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Registrar movimiento'}
          </button>

          <Link className="button secondary" to="/movements">
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
