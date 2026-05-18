import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { post } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';

export default function CreateMovementPage() {
  const navigate = useNavigate();
  const { catalogs, loading: loadingCatalogs, error: catalogsError } = useCatalogs();

  const [formData, setFormData] = useState({
    tipoOperacion: 'LOTE',
    motivo: 'Movimiento de manejo',
    fecha: '',
    unidadRegaId: '',
    corralDestinoId: '',
    crotalesTexto: ''
  });

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
    return formData.crotalesTexto
      .split(/\n|,|;/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function buildPayload() {
    return {
      tipoOperacion: formData.tipoOperacion,
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
        throw new Error('Debes indicar al menos un crotal.');
      }

      const createdMovement = await post('/movements', buildPayload());

      if (!createdMovement?.id) {
        throw new Error('El movimiento se creó, pero no se recibió un id válido.');
      }

      navigate('/movements');
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
          <p className="eyebrow">Movimiento de animales</p>
          <h2>Registrar movimiento</h2>
          <p>
            Registra un movimiento individual o en lote hacia un corral destino.
          </p>
        </div>

        <Link className="button secondary" to="/movements">
          Volver a movimientos
        </Link>
      </header>

      <form className="form-card wide-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label>
            Tipo de operación *
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

        <label>
          Crotales *
          <textarea
            name="crotalesTexto"
            value={formData.crotalesTexto}
            onChange={handleChange}
            rows="8"
            placeholder={'Introduce un crotal por línea, o separados por coma/;'}
            required
          />
        </label>

        <div className="panel">
          <h3>Vista previa</h3>
          <p>
            Se enviarán <strong>{getCrotales().length}</strong> crotales al backend.
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