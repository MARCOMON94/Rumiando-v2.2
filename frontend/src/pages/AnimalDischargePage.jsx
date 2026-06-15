import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { get, put } from '../api/apiClient';

const DISCHARGE_REASONS = [
  'Muerte',
  'Venta / traslado',
  'Sacrificio',
  'Desaparecido',
  'Otro'
];

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function getItem(data) {
  return data?.animal || data?.data || data;
}

export default function AnimalDischargePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [animal, setAnimal] = useState(null);
  const [fechaSalida] = useState(todayInput());
  const [motivo, setMotivo] = useState(() => {
    if (!location.state?.motivo) return 'Muerte';
    return DISCHARGE_REASONS.includes(location.state.motivo) ? location.state.motivo : 'Otro';
  });
  const [motivoOtro, setMotivoOtro] = useState(() => (
    location.state?.motivo && !DISCHARGE_REASONS.includes(location.state.motivo)
      ? String(location.state.motivo)
      : ''
  ));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const saveInFlightRef = useRef(false);

  const returnTo = location.state?.returnTo;
  const returnMode = location.state?.returnMode;

  useEffect(() => {
    let ignore = false;

    async function loadAnimal() {
      setLoading(true);
      setError('');

      try {
        const raw = await get(`/animals/${id}`);
        const animalData = getItem(raw);

        if (!animalData?.id) {
          throw new Error('No se encontro el animal.');
        }

        if (!ignore) setAnimal(animalData);
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadAnimal();

    return () => {
      ignore = true;
    };
  }, [id]);

  function closeFlow() {
    if (returnMode === 'back') {
      navigate(-1);
      return;
    }

    if (returnTo) {
      navigate(returnTo, { replace: true });
      return;
    }

    navigate('/animals');
  }

  function finalReason() {
    if (motivo === 'Otro') {
      return motivoOtro.trim() || 'Otro';
    }

    return motivo;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!animal?.id || saveInFlightRef.current || done) return;

    saveInFlightRef.current = true;
    setSaving(true);
    setError('');

    try {
      await put(`/animals/${animal.id}`, {
        estadoRegistro: 'BAJA',
        fechaSalida,
        destinoSalida: finalReason(),
        observaciones: `Baja registrada desde flujo móvil: ${finalReason()}.`
      });

      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  if (loading) return <p>Cargando baja...</p>;
  if (error && !animal) return <p className="alert error">Error: {error}</p>;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>{animal?.crotal}</h2>
          <p>Marca el animal como baja sin abrir paneles adicionales.</p>
        </div>

        <button type="button" className="secondary" onClick={closeFlow}>
          Cerrar
        </button>
      </header>

      {done ? (
        <section className="form-card">
          <h3>Baja registrada</h3>
          <p className="muted">
            {animal.crotal} queda marcado como baja por {finalReason()}.
          </p>
          <div className="form-actions">
            <button type="button" onClick={closeFlow}>
              Finalizar
            </button>
          </div>
        </section>
      ) : (
        <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Causa de muerte
              <select value={motivo} onChange={(event) => setMotivo(event.target.value)}>
                {DISCHARGE_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>

            {motivo === 'Otro' && (
              <label>
                Otra causa
                <input
                  value={motivoOtro}
                  onChange={(event) => setMotivoOtro(event.target.value)}
                  placeholder="Indica la causa"
                />
              </label>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar baja'}
            </button>

            <button type="button" className="secondary" onClick={closeFlow}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
