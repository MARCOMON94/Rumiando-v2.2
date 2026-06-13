import { useEffect, useMemo, useState } from 'react';
import { del, get, post, put } from '../../api/apiClient';
import AppModal from '../ui/AppModal';

const REPRODUCTIVE_EVENTS = [
  ['CUBRICION', 'Cubrición'],
  ['INSEMINACION', 'Inseminación'],
  ['DIAGNOSTICO_GESTACION', 'Diagnóstico de gestación'],
  ['PARTO', 'Parto'],
  ['ABORTO', 'Aborto'],
  ['SECADO', 'Secado'],
  ['BAJA_REPRODUCTIVA', 'Baja reproductiva'],
  ['REVISION_REPRODUCTIVA', 'Revisión reproductiva']
];

const EVENT_RESULTS = [
  ['NO_APLICA', 'No aplica'],
  ['POSITIVO', 'Positivo'],
  ['NEGATIVO', 'Negativo'],
  ['DUDOSO', 'Dudoso']
];

function getArray(data, key) {
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function emptyForm() {
  return {
    id: null,
    tipo: 'CORRAL_A_REPRODUCCION',
    activo: true,
    unidadRegaId: '',
    triggerCorralId: '',
    triggerEstadoReproductivoId: '',
    triggerEventoReproductivo: '',
    targetCorralId: '',
    targetEstadoReproductivoId: '',
    targetEventoReproductivo: '',
    targetResultadoEvento: 'NO_APLICA'
  };
}

function ruleTitle(rule) {
  if (rule.tipo === 'CORRAL_A_REPRODUCCION') {
    return `${rule.triggerCorral?.nombre || 'Corral'} → reproducción`;
  }

  return `Reproducción → ${rule.targetCorral?.nombre || 'corral'}`;
}

export default function ManagementRulesPanel() {
  const [catalogs, setCatalogs] = useState({
    farmUnits: [],
    pens: [],
    reproductiveStatuses: []
  });
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingDeleteRule, setPendingDeleteRule] = useState(null);

  const filteredPens = useMemo(() => {
    if (!form.unidadRegaId) return catalogs.pens;

    return catalogs.pens.filter((pen) => (
      Number(pen.unidadRegaId || pen.unidadRega?.id) === Number(form.unidadRegaId)
    ));
  }, [catalogs.pens, form.unidadRegaId]);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [catalogData, rulesData] = await Promise.all([
        get('/catalogs'),
        get('/management-rules')
      ]);

      setCatalogs({
        farmUnits: getArray(catalogData, 'farmUnits'),
        pens: getArray(catalogData, 'pens'),
        reproductiveStatuses: getArray(catalogData, 'reproductiveStatuses')
      });
      setRules(Array.isArray(rulesData?.data) ? rulesData.data : []);
    } catch (err) {
      setError(err.message || 'Error cargando automatización');
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

  function editRule(rule) {
    setForm({
      id: rule.id,
      tipo: rule.tipo,
      activo: rule.activo !== false,
      unidadRegaId: rule.unidadRegaId ? String(rule.unidadRegaId) : '',
      triggerCorralId: rule.triggerCorralId ? String(rule.triggerCorralId) : '',
      triggerEstadoReproductivoId: rule.triggerEstadoReproductivoId
        ? String(rule.triggerEstadoReproductivoId)
        : '',
      triggerEventoReproductivo: rule.triggerEventoReproductivo || '',
      targetCorralId: rule.targetCorralId ? String(rule.targetCorralId) : '',
      targetEstadoReproductivoId: rule.targetEstadoReproductivoId
        ? String(rule.targetEstadoReproductivoId)
        : '',
      targetEventoReproductivo: rule.targetEventoReproductivo || '',
      targetResultadoEvento: rule.targetResultadoEvento || 'NO_APLICA'
    });
    setMessage('');
  }

  function buildPayload() {
    return {
      tipo: form.tipo,
      activo: form.activo,
      unidadRegaId: form.unidadRegaId || null,
      triggerCorralId: form.tipo === 'CORRAL_A_REPRODUCCION' ? form.triggerCorralId || null : null,
      triggerEstadoReproductivoId: form.tipo === 'REPRODUCCION_A_CORRAL'
        ? form.triggerEstadoReproductivoId || null
        : null,
      triggerEventoReproductivo: form.tipo === 'REPRODUCCION_A_CORRAL'
        ? form.triggerEventoReproductivo || null
        : null,
      targetCorralId: form.tipo === 'REPRODUCCION_A_CORRAL' ? form.targetCorralId || null : null,
      targetEstadoReproductivoId: form.tipo === 'CORRAL_A_REPRODUCCION'
        ? form.targetEstadoReproductivoId || null
        : null,
      targetEventoReproductivo: form.tipo === 'CORRAL_A_REPRODUCCION'
        ? form.targetEventoReproductivo || null
        : null,
      targetResultadoEvento: form.tipo === 'CORRAL_A_REPRODUCCION'
        ? form.targetResultadoEvento || null
        : null
    };
  }

  async function saveRule(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (form.id) {
        await put(`/management-rules/${form.id}`, buildPayload());
      } else {
        await post('/management-rules', buildPayload());
      }

      setForm(emptyForm());
      setMessage('Automatización guardada.');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(rule) {
    setSaving(true);
    setError('');

    try {
      await del(`/management-rules/${rule.id}`);
      setMessage('Automatización eliminada.');
      setPendingDeleteRule(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Cargando automatización...</p>;
  }

  return (
    <div className="settings-management-panel">
      {error && <p className="alert error">{error}</p>}
      {message && <p className="alert">{message}</p>}

      <form className="settings-subform" onSubmit={saveRule}>
        <label>
          Tipo
          <select
            value={form.tipo}
            onChange={(event) => setField('tipo', event.target.value)}
          >
            <option value="CORRAL_A_REPRODUCCION">Al pasar a corral, sugerir reproducción</option>
            <option value="REPRODUCCION_A_CORRAL">Al cambiar reproducción, sugerir corral</option>
          </select>
        </label>

        <label>
          REGA
          <select
            value={form.unidadRegaId}
            onChange={(event) => setField('unidadRegaId', event.target.value)}
          >
            <option value="">Todas</option>
            {catalogs.farmUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.nombre || unit.codigoRega}
              </option>
            ))}
          </select>
        </label>

        {form.tipo === 'CORRAL_A_REPRODUCCION' ? (
          <>
            <label>
              Al pasar animal a corral
              <select
                value={form.triggerCorralId}
                onChange={(event) => setField('triggerCorralId', event.target.value)}
                required
              >
                <option value="">Selecciona corral</option>
                {filteredPens.map((pen) => (
                  <option key={pen.id} value={pen.id}>
                    {pen.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Pasa a estado
              <select
                value={form.targetEstadoReproductivoId}
                onChange={(event) => setField('targetEstadoReproductivoId', event.target.value)}
              >
                <option value="">Sin cambio de estado</option>
                {catalogs.reproductiveStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Evento asociado
              <select
                value={form.targetEventoReproductivo}
                onChange={(event) => setField('targetEventoReproductivo', event.target.value)}
              >
                <option value="">Sin evento</option>
                {REPRODUCTIVE_EVENTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Resultado
              <select
                value={form.targetResultadoEvento}
                onChange={(event) => setField('targetResultadoEvento', event.target.value)}
              >
                {EVENT_RESULTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              Estado que dispara
              <select
                value={form.triggerEstadoReproductivoId}
                onChange={(event) => setField('triggerEstadoReproductivoId', event.target.value)}
              >
                <option value="">Cualquier estado</option>
                {catalogs.reproductiveStatuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Evento que dispara
              <select
                value={form.triggerEventoReproductivo}
                onChange={(event) => setField('triggerEventoReproductivo', event.target.value)}
              >
                <option value="">Cualquier evento</option>
                {REPRODUCTIVE_EVENTS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Mover a corral
              <select
                value={form.targetCorralId}
                onChange={(event) => setField('targetCorralId', event.target.value)}
                required
              >
                <option value="">Selecciona corral</option>
                {filteredPens.map((pen) => (
                  <option key={pen.id} value={pen.id}>
                    {pen.nombre}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="batch-checkbox">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(event) => setField('activo', event.target.checked)}
          />
          Activa
        </label>

        <button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear automatización'}
        </button>
      </form>

      <section className="settings-subform">
        <h3>Automatizaciones actuales</h3>

        {rules.length === 0 ? (
          <p className="muted">No hay automatizaciones creadas.</p>
        ) : (
          <div className="settings-list">
            {rules.map((rule) => (
              <article className="settings-list-row" key={rule.id}>
                <div>
                  <strong>{ruleTitle(rule)}</strong>
                  <span>{rule.activo ? 'Activa' : 'Inactiva'}</span>
                </div>
                <button type="button" className="secondary" onClick={() => editRule(rule)}>
                  Editar
                </button>
                <button type="button" className="secondary" onClick={() => setPendingDeleteRule(rule)}>
                  Eliminar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <AppModal
        open={Boolean(pendingDeleteRule)}
        title="Eliminar automatización"
        description={pendingDeleteRule ? `Eliminar ${ruleTitle(pendingDeleteRule)}.` : ''}
        onClose={() => {
          if (!saving) setPendingDeleteRule(null);
        }}
      >
        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => setPendingDeleteRule(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => deleteRule(pendingDeleteRule)}
          >
            {saving ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </AppModal>
    </div>
  );
}
