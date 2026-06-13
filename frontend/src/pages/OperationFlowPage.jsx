import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';
import AppModal from '../components/ui/AppModal';

const OPERATION_META = {
  movement: {
    title: 'Movimiento de corral',
    description: 'Elige el corral destino, pasa crotales y registra el movimiento en lote.'
  },
  reproductive: {
    title: 'Estado reproductivo',
    description: 'Elige el cambio reproductivo, pasa crotales y finaliza cuando esté la lista.'
  },
  health: {
    title: 'Caso sanitario',
    description: 'Registra vacunación, enfermedad o desparasitación para los animales leídos.'
  }
};

const REPRODUCTIVE_EVENTS = [
  ['REVISION_REPRODUCTIVA', 'Revisión reproductiva'],
  ['CUBRICION', 'Cubrición'],
  ['INSEMINACION', 'Inseminación'],
  ['DIAGNOSTICO_GESTACION', 'Diagnóstico de gestación'],
  ['PARTO', 'Parto'],
  ['ABORTO', 'Aborto'],
  ['SECADO', 'Secado'],
  ['BAJA_REPRODUCTIVA', 'Baja reproductiva']
];

const EVENT_RESULTS = [
  ['POSITIVO', 'Positivo'],
  ['NEGATIVO', 'Negativo'],
  ['DUDOSO', 'Dudoso'],
  ['NO_APLICA', 'No aplica']
];

const HEALTH_TYPES = [
  ['vaccination', 'Vacunación'],
  ['disease', 'Enfermedad'],
  ['deworming', 'Desparasitación']
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function extractCodes(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeCode)
    .filter(Boolean);
}

function getItems(data, keys) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function isEditableTarget(target) {
  const tagName = String(target?.tagName || '').toLowerCase();
  return ['input', 'textarea', 'select', 'button', 'a'].includes(tagName)
    || Boolean(target?.isContentEditable);
}

function animalMatchesCode(animal, code) {
  const normalized = normalizeCode(code);
  return [animal?.crotal, animal?.numeroInterno]
    .filter(Boolean)
    .some((value) => normalizeCode(value) === normalized);
}

function animalPenName(animal) {
  return animal?.corralActual?.nombre || animal?.corralActual?.name || 'Sin corral';
}

function animalUnitId(animal) {
  return Number(animal?.unidadRegaId || animal?.unidadRega?.id || 0);
}

function formatRuleName(rule) {
  if (!rule) return '';

  if (rule.tipo === 'CORRAL_A_REPRODUCCION') {
    const status = rule.targetEstadoReproductivo?.nombre;
    const event = rule.targetEventoReproductivo;
    return [status, event].filter(Boolean).join(' + ');
  }

  return rule.targetCorral?.nombre || 'corral configurado';
}

function buildRuleQuery(type, rule) {
  if (type === 'movement') {
    return `¿Quieres aplicar también este cambio reproductivo? ${formatRuleName(rule)}`;
  }

  return `¿Quieres mover también estos animales a ${formatRuleName(rule)}?`;
}

export default function OperationFlowPage() {
  const { type } = useParams();
  const navigate = useNavigate();
  const operationType = OPERATION_META[type] ? type : 'movement';
  const meta = OPERATION_META[operationType];
  const { catalogs, loading: loadingCatalogs, error: catalogsError, loadCatalogs } = useCatalogs();

  const readerInputRef = useRef(null);
  const readerBufferRef = useRef('');
  const readerTimerRef = useRef(null);

  const [animals, setAnimals] = useState([]);
  const [rules, setRules] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [readerMessage, setReaderMessage] = useState('Pasa crotales y se irán añadiendo a la lista.');
  const [removeCandidate, setRemoveCandidate] = useState(null);
  const [pendingRule, setPendingRule] = useState(null);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fecha: todayInputValue(),
    unidadRegaId: '',
    corralDestinoId: '',
    motivo: '',
    estadoResultanteId: '',
    tipoEvento: 'REVISION_REPRODUCTIVA',
    resultado: 'NO_APLICA',
    semanasGestacion: '',
    healthType: 'vaccination',
    fullPen: false,
    sourcePenId: '',
    vacuna: '',
    loteVacuna: '',
    dosisTexto: '',
    via: '',
    enfermedadId: '',
    gravedad: 'LEVE',
    signosClinicos: '',
    desparasitacionTipo: 'Interna',
    producto: ''
  });

  const activeAnimals = useMemo(() => (
    animals.filter((animal) => animal.estadoRegistro !== 'BAJA')
  ), [animals]);

  const filteredPens = useMemo(() => {
    if (!formData.unidadRegaId) return catalogs.pens;

    return catalogs.pens.filter((pen) => (
      Number(pen.unidadRegaId || pen.unidadRega?.id) === Number(formData.unidadRegaId)
    ));
  }, [catalogs.pens, formData.unidadRegaId]);

  const matchingMovementRule = useMemo(() => {
    if (!formData.corralDestinoId) return null;

    return rules.find((rule) => (
      rule.activo !== false
      && rule.tipo === 'CORRAL_A_REPRODUCCION'
      && Number(rule.triggerCorralId || rule.triggerCorral?.id) === Number(formData.corralDestinoId)
      && (!rule.unidadRegaId || Number(rule.unidadRegaId) === Number(formData.unidadRegaId))
    )) || null;
  }, [formData.corralDestinoId, formData.unidadRegaId, rules]);

  const matchingReproductiveRule = useMemo(() => (
    rules.find((rule) => (
      rule.activo !== false
      && rule.tipo === 'REPRODUCCION_A_CORRAL'
      && (!rule.unidadRegaId || Number(rule.unidadRegaId) === Number(formData.unidadRegaId))
      && (
        (rule.triggerEstadoReproductivoId
          && Number(rule.triggerEstadoReproductivoId) === Number(formData.estadoResultanteId))
        || (rule.triggerEventoReproductivo && rule.triggerEventoReproductivo === formData.tipoEvento)
      )
    )) || null
  ), [formData.estadoResultanteId, formData.tipoEvento, formData.unidadRegaId, rules]);

  const selectedCrotales = useMemo(() => (
    selectedAnimals
      .map((animal) => animal.crotal || animal.numeroInterno)
      .filter(Boolean)
  ), [selectedAnimals]);

  const focusReader = useCallback(function focusReader() {
    window.setTimeout(() => {
      readerInputRef.current?.focus();
    }, 0);
  }, []);

  const resetReaderBuffer = useCallback(function resetReaderBuffer() {
    window.clearTimeout(readerTimerRef.current);
    readerBufferRef.current = '';
  }, []);

  const setField = useCallback(function setField(name, value) {
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
    focusReader();
  }, [focusReader]);

  const addCodes = useCallback(function addCodes(rawCodes) {
    const codes = Array.isArray(rawCodes) ? rawCodes : extractCodes(rawCodes);
    if (!codes.length) return;

    setResult(null);
    setError('');

    let addedCount = 0;
    let duplicateCount = 0;
    let unknownCount = 0;
    let wrongUnitCount = 0;

    setSelectedAnimals((current) => {
      const next = [...current];

      for (const code of codes) {
        const animal = activeAnimals.find((item) => animalMatchesCode(item, code));

        if (!animal) {
          unknownCount++;
          continue;
        }

        if (formData.unidadRegaId && animalUnitId(animal) !== Number(formData.unidadRegaId)) {
          wrongUnitCount++;
          continue;
        }

        if (!formData.unidadRegaId) {
          setFormData((currentForm) => ({
            ...currentForm,
            unidadRegaId: String(animalUnitId(animal) || '')
          }));
        }

        if (next.some((item) => item.id === animal.id)) {
          duplicateCount++;
          continue;
        }

        next.push(animal);
        addedCount++;
      }

      return next;
    });

    const parts = [];
    if (addedCount) parts.push(`${addedCount} añadido${addedCount === 1 ? '' : 's'}`);
    if (duplicateCount) parts.push(`${duplicateCount} repetido${duplicateCount === 1 ? '' : 's'}`);
    if (unknownCount) parts.push(`${unknownCount} no encontrado${unknownCount === 1 ? '' : 's'}`);
    if (wrongUnitCount) parts.push(`${wrongUnitCount} de otra REGA`);

    setReaderMessage(parts.length ? parts.join(' · ') : 'Pasa crotales y se irán añadiendo a la lista.');
    focusReader();
  }, [activeAnimals, focusReader, formData.unidadRegaId]);

  const flushReaderBuffer = useCallback(function flushReaderBuffer() {
    const raw = readerBufferRef.current;
    resetReaderBuffer();
    addCodes(extractCodes(raw));
  }, [addCodes, resetReaderBuffer]);

  const handleReaderKeyDown = useCallback(function handleReaderKeyDown(event) {
    const finishKey = event.key === 'Enter' || event.key === 'Tab';
    const characterKey = event.key.length === 1;

    if (!finishKey && !characterKey && event.key !== 'Backspace') return;

    event.preventDefault();

    if (finishKey) {
      flushReaderBuffer();
      return;
    }

    if (event.key === 'Backspace') {
      readerBufferRef.current = readerBufferRef.current.slice(0, -1);
      return;
    }

    readerBufferRef.current += event.key;
    window.clearTimeout(readerTimerRef.current);
    readerTimerRef.current = window.setTimeout(flushReaderBuffer, 180);
  }, [flushReaderBuffer]);

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      setError('');

      try {
        const [animalsData, rulesData] = await Promise.all([
          get('/animals?estadoRegistro=ACTIVO'),
          get('/management-rules?activo=true')
        ]);

        setAnimals(getItems(animalsData, ['data', 'animals', 'animales']));
        setRules(getItems(rulesData, ['data', 'rules']));
      } catch (err) {
        setError(err.message || 'Error cargando datos de trabajo');
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
    focusReader();

    return () => {
      window.clearTimeout(readerTimerRef.current);
    };
  }, [focusReader]);

  useEffect(() => {
    if (formData.unidadRegaId || catalogs.farmUnits.length === 0) return;

    setFormData((current) => ({
      ...current,
      unidadRegaId: String(catalogs.farmUnits[0]?.id || '')
    }));
  }, [catalogs.farmUnits, formData.unidadRegaId]);

  useEffect(() => {
    if (operationType !== 'health' || !formData.fullPen || !formData.sourcePenId) return;

    const penAnimals = activeAnimals.filter((animal) => (
      Number(animal.corralActualId || animal.corralActual?.id) === Number(formData.sourcePenId)
    ));

    setSelectedAnimals(penAnimals);
    setReaderMessage(
      penAnimals.length > 0
        ? `${penAnimals.length} animales cargados desde el corral.`
        : 'Ese corral no tiene animales activos.'
    );
  }, [activeAnimals, formData.fullPen, formData.sourcePenId, operationType]);

  useEffect(() => {
    function handleCapturePaste(event) {
      if (isEditableTarget(event.target)) return;

      const pasted = event.clipboardData?.getData('text');
      if (!pasted) return;

      event.preventDefault();
      event.stopPropagation();
      addCodes(extractCodes(pasted));
    }

    function handleCaptureKeyDown(event) {
      if (isEditableTarget(event.target)) return;
      handleReaderKeyDown(event);
    }

    window.addEventListener('paste', handleCapturePaste, true);
    window.addEventListener('keydown', handleCaptureKeyDown, true);

    return () => {
      window.removeEventListener('paste', handleCapturePaste, true);
      window.removeEventListener('keydown', handleCaptureKeyDown, true);
    };
  }, [addCodes, handleReaderKeyDown]);

  function handleChange(event) {
    const { name, type: inputType, checked, value } = event.target;
    setField(name, inputType === 'checkbox' ? checked : value);
  }

  function askRemoveAnimal(animal) {
    setRemoveCandidate(animal);
  }

  function removeSelectedAnimal() {
    if (!removeCandidate) return;

    setSelectedAnimals((current) => current.filter((animal) => animal.id !== removeCandidate.id));
    setRemoveCandidate(null);
    setReaderMessage('Animal quitado de la lista.');
    focusReader();
  }

  function validateCommon() {
    if (selectedAnimals.length === 0) {
      throw new Error('Debes leer al menos un animal.');
    }

    if (!formData.fecha) {
      throw new Error('La fecha es obligatoria.');
    }

    if (!formData.unidadRegaId) {
      throw new Error('Selecciona una unidad REGA.');
    }
  }

  function buildSummary(successCount, failures) {
    setResult({
      successCount,
      failedCount: failures.length,
      failures
    });
  }

  async function createReproductiveEvents(applyRule, rule) {
    const failures = [];
    let successCount = 0;

    for (const animal of selectedAnimals) {
      try {
        await post('/reproductive-events', {
          tipoEvento: formData.tipoEvento,
          resultado: formData.tipoEvento === 'DIAGNOSTICO_GESTACION' ? formData.resultado : 'NO_APLICA',
          fecha: formData.fecha,
          semanasGestacion: formData.tipoEvento === 'DIAGNOSTICO_GESTACION'
            ? formData.semanasGestacion || null
            : null,
          observaciones: 'Registrado desde flujo por lector.',
          animalId: animal.id,
          estadoResultanteId: formData.estadoResultanteId || null
        });
        successCount++;
      } catch (err) {
        failures.push(`${animal.crotal}: ${err.message}`);
      }
    }

    if (applyRule && rule?.targetCorralId && successCount > 0) {
      try {
        await post('/movements', {
          tipoOperacion: selectedAnimals.length === 1 ? 'INDIVIDUAL' : 'LOTE',
          motivo: 'Movimiento sugerido por cambio reproductivo',
          fecha: formData.fecha,
          unidadRegaId: Number(formData.unidadRegaId),
          corralDestinoId: Number(rule.targetCorralId),
          crotales: selectedCrotales
        });
      } catch (err) {
        failures.push(`Movimiento asociado: ${err.message}`);
      }
    }

    buildSummary(successCount, failures);
  }

  async function createMovement(applyRule, rule) {
    if (!formData.corralDestinoId) {
      throw new Error('Selecciona el corral destino.');
    }

    const movement = await post('/movements', {
      tipoOperacion: selectedAnimals.length === 1 ? 'INDIVIDUAL' : 'LOTE',
      motivo: formData.motivo || 'Movimiento de manejo',
      fecha: formData.fecha,
      unidadRegaId: Number(formData.unidadRegaId),
      corralDestinoId: Number(formData.corralDestinoId),
      crotales: selectedCrotales,
      aplicarEstadoReproductivo: Boolean(applyRule && rule?.targetEstadoReproductivoId),
      estadoReproductivoDestinoId: applyRule && rule?.targetEstadoReproductivoId
        ? Number(rule.targetEstadoReproductivoId)
        : null
    });

    const summary = movement?.resumen || {};
    const failures = [];

    if (applyRule && rule?.targetEventoReproductivo) {
      for (const animal of selectedAnimals) {
        try {
          await post('/reproductive-events', {
            tipoEvento: rule.targetEventoReproductivo,
            resultado: rule.targetResultadoEvento || 'NO_APLICA',
            fecha: formData.fecha,
            observaciones: 'Evento sugerido por movimiento de corral.',
            animalId: animal.id,
            estadoResultanteId: rule.targetEstadoReproductivoId || null
          });
        } catch (err) {
          failures.push(`${animal.crotal}: ${err.message}`);
        }
      }
    }

    const successCount = Number(summary.procesados || 0) + Number(summary.yaEnDestino || 0);
    const backendFailures = Number(summary.noEncontrados || 0);

    if (backendFailures > 0) {
      failures.push(`${backendFailures} lectura${backendFailures === 1 ? '' : 's'} no encontrada${backendFailures === 1 ? '' : 's'}.`);
    }

    buildSummary(successCount || selectedAnimals.length - failures.length, failures);
  }

  async function createHealthRecords() {
    const failures = [];
    let successCount = 0;

    for (const animal of selectedAnimals) {
      const corralId = animal.corralActualId || animal.corralActual?.id || formData.sourcePenId || null;

      try {
        if (formData.healthType === 'vaccination') {
          await post('/vaccinations', {
            fecha: formData.fecha,
            vacuna: formData.vacuna,
            loteVacuna: formData.loteVacuna || null,
            dosisTexto: formData.dosisTexto || null,
            via: formData.via || null,
            unidadRegaId: Number(formData.unidadRegaId),
            animalId: animal.id,
            corralId
          });
        }

        if (formData.healthType === 'disease') {
          await post('/health-cases', {
            fechaInicio: formData.fecha,
            signosClinicos: formData.signosClinicos || null,
            diagnosticoPresuntivo: formData.signosClinicos || 'Caso registrado desde lector',
            gravedad: formData.gravedad || null,
            unidadRegaId: Number(formData.unidadRegaId),
            animalId: animal.id,
            corralId,
            enfermedadId: formData.enfermedadId || null
          });
        }

        if (formData.healthType === 'deworming') {
          await post('/dewormings', {
            fecha: formData.fecha,
            tipo: formData.desparasitacionTipo,
            producto: formData.producto,
            dosisTexto: formData.dosisTexto || null,
            via: formData.via || null,
            motivo: formData.motivo || null,
            unidadRegaId: Number(formData.unidadRegaId),
            animalId: animal.id,
            corralId
          });
        }

        successCount++;
      } catch (err) {
        failures.push(`${animal.crotal}: ${err.message}`);
      }
    }

    buildSummary(successCount, failures);
  }

  async function runOperation(applyRule = false, rule = null) {
    setSaving(true);
    setError('');
    setPendingRule(null);

    try {
      validateCommon();

      if (operationType === 'movement') {
        await createMovement(applyRule, rule);
      }

      if (operationType === 'reproductive') {
        if (!formData.estadoResultanteId && !formData.tipoEvento) {
          throw new Error('Selecciona un estado o evento reproductivo.');
        }
        await createReproductiveEvents(applyRule, rule);
      }

      if (operationType === 'health') {
        if (formData.healthType === 'vaccination' && !formData.vacuna) {
          throw new Error('Indica la vacuna.');
        }
        if (formData.healthType === 'deworming' && !formData.producto) {
          throw new Error('Indica el producto de desparasitación.');
        }
        await createHealthRecords();
      }

      await loadCatalogs?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      focusReader();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      validateCommon();
    } catch (err) {
      setError(err.message);
      return;
    }

    if (operationType === 'movement' && matchingMovementRule) {
      setPendingRule({
        type: 'movement',
        rule: matchingMovementRule
      });
      return;
    }

    if (operationType === 'reproductive' && matchingReproductiveRule) {
      setPendingRule({
        type: 'reproductive',
        rule: matchingReproductiveRule
      });
      return;
    }

    runOperation(false, null);
  }

  function resetOperation() {
    setSelectedAnimals([]);
    setResult(null);
    setError('');
    setReaderMessage('Pasa crotales y se irán añadiendo a la lista.');
    focusReader();
  }

  if (loadingCatalogs || loadingData) {
    return <p>Cargando flujo de trabajo...</p>;
  }

  if (catalogsError) {
    return <p className="alert error">Error cargando catálogos: {catalogsError}</p>;
  }

  return (
    <section className="page batch-operation-page">
      <header className="page-header batch-operation-header">
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </div>

        <button type="button" className="secondary" onClick={() => navigate('/home')}>
          Volver
        </button>
      </header>

      <form className="batch-operation-card" onSubmit={handleSubmit}>
        <input
          ref={readerInputRef}
          className="batch-reader-input"
          aria-label="Lector activo"
          inputMode="none"
          autoComplete="off"
          onKeyDown={handleReaderKeyDown}
          onPaste={(event) => {
            event.preventDefault();
            addCodes(extractCodes(event.clipboardData?.getData('text')));
          }}
        />

        <div className="batch-reader-status">
          <span className="batch-reader-dot" aria-hidden="true" />
          <strong>Lector activo</strong>
          <p>{readerMessage}</p>
        </div>

        <div className="form-grid batch-operation-form-grid">
          <label>
            Fecha
            <input
              type="date"
              name="fecha"
              value={formData.fecha}
              onChange={handleChange}
              onBlur={focusReader}
              required
            />
          </label>

          <label>
            Unidad REGA
            <select
              name="unidadRegaId"
              value={formData.unidadRegaId}
              onChange={handleChange}
              onBlur={focusReader}
              required
            >
              <option value="">Selecciona REGA</option>
              {catalogs.farmUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.nombre || unit.codigoRega || `REGA ${unit.id}`}
                </option>
              ))}
            </select>
          </label>

          {operationType === 'movement' && (
            <>
              <label>
                Corral destino
                <select
                  name="corralDestinoId"
                  value={formData.corralDestinoId}
                  onChange={handleChange}
                  onBlur={focusReader}
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
                Motivo
                <input
                  name="motivo"
                  value={formData.motivo}
                  onChange={handleChange}
                  onBlur={focusReader}
                  placeholder="Opcional"
                />
              </label>
            </>
          )}

          {operationType === 'reproductive' && (
            <>
              <label>
                Estado destino
                <select
                  name="estadoResultanteId"
                  value={formData.estadoResultanteId}
                  onChange={handleChange}
                  onBlur={focusReader}
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
                Evento reproductivo
                <select
                  name="tipoEvento"
                  value={formData.tipoEvento}
                  onChange={handleChange}
                  onBlur={focusReader}
                >
                  {REPRODUCTIVE_EVENTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {formData.tipoEvento === 'DIAGNOSTICO_GESTACION' && (
                <>
                  <label>
                    Resultado
                    <select
                      name="resultado"
                      value={formData.resultado}
                      onChange={handleChange}
                      onBlur={focusReader}
                    >
                      {EVENT_RESULTS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Semanas estimadas
                    <input
                      type="number"
                      min="0"
                      name="semanasGestacion"
                      value={formData.semanasGestacion}
                      onChange={handleChange}
                      onBlur={focusReader}
                      placeholder="Opcional"
                    />
                  </label>
                </>
              )}
            </>
          )}

          {operationType === 'health' && (
            <>
              <label>
                Tipo
                <select
                  name="healthType"
                  value={formData.healthType}
                  onChange={handleChange}
                  onBlur={focusReader}
                >
                  {HEALTH_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="batch-checkbox">
                <input
                  type="checkbox"
                  name="fullPen"
                  checked={formData.fullPen}
                  onChange={handleChange}
                  onBlur={focusReader}
                />
                Corral completo
              </label>

              {formData.fullPen && (
                <label>
                  Corral
                  <select
                    name="sourcePenId"
                    value={formData.sourcePenId}
                    onChange={handleChange}
                    onBlur={focusReader}
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
              )}

              {formData.healthType === 'vaccination' && (
                <>
                  <label>
                    Vacuna
                    <input
                      name="vacuna"
                      value={formData.vacuna}
                      onChange={handleChange}
                      onBlur={focusReader}
                      required
                    />
                  </label>
                  <label>
                    Lote
                    <input
                      name="loteVacuna"
                      value={formData.loteVacuna}
                      onChange={handleChange}
                      onBlur={focusReader}
                      placeholder="Opcional"
                    />
                  </label>
                </>
              )}

              {formData.healthType === 'disease' && (
                <>
                  <label>
                    Enfermedad
                    <select
                      name="enfermedadId"
                      value={formData.enfermedadId}
                      onChange={handleChange}
                      onBlur={focusReader}
                    >
                      <option value="">Sin catálogo</option>
                      {catalogs.diseases.map((disease) => (
                        <option key={disease.id} value={disease.id}>
                          {disease.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Gravedad
                    <select
                      name="gravedad"
                      value={formData.gravedad}
                      onChange={handleChange}
                      onBlur={focusReader}
                    >
                      <option value="LEVE">Leve</option>
                      <option value="MEDIA">Media</option>
                      <option value="GRAVE">Grave</option>
                    </select>
                  </label>
                </>
              )}

              {formData.healthType === 'deworming' && (
                <>
                  <label>
                    Tipo
                    <select
                      name="desparasitacionTipo"
                      value={formData.desparasitacionTipo}
                      onChange={handleChange}
                      onBlur={focusReader}
                    >
                      <option value="Interna">Interna</option>
                      <option value="Externa">Externa</option>
                      <option value="Mixta">Mixta</option>
                    </select>
                  </label>
                  <label>
                    Producto
                    <input
                      name="producto"
                      value={formData.producto}
                      onChange={handleChange}
                      onBlur={focusReader}
                      required
                    />
                  </label>
                </>
              )}

              {formData.healthType !== 'disease' && (
                <>
                  <label>
                    Dosis
                    <input
                      name="dosisTexto"
                      value={formData.dosisTexto}
                      onChange={handleChange}
                      onBlur={focusReader}
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    Vía
                    <input
                      name="via"
                      value={formData.via}
                      onChange={handleChange}
                      onBlur={focusReader}
                      placeholder="Opcional"
                    />
                  </label>
                </>
              )}

              {formData.healthType === 'disease' && (
                <label className="batch-full-row">
                  Signos o motivo
                  <textarea
                    name="signosClinicos"
                    rows="3"
                    value={formData.signosClinicos}
                    onChange={handleChange}
                    onBlur={focusReader}
                    placeholder="Opcional"
                  />
                </label>
              )}
            </>
          )}
        </div>

        <section className="batch-selected-list" aria-label="Animales seleccionados">
          <header>
            <div>
              <h3>Lista</h3>
              <p>{selectedAnimals.length} animales preparados</p>
            </div>
            {selectedAnimals.length > 0 && (
              <button type="button" className="secondary" onClick={resetOperation}>
                Limpiar
              </button>
            )}
          </header>

          {selectedAnimals.length === 0 ? (
            <p className="batch-empty-hint">Pasa crotales y se irán añadiendo a la lista.</p>
          ) : (
            <div className="batch-animal-list">
              {selectedAnimals.map((animal) => (
                <article className="batch-animal-row" key={animal.id}>
                  <div>
                    <strong>{animal.crotal}</strong>
                    <span>{animalPenName(animal)}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => askRemoveAnimal(animal)}
                  >
                    Quitar
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {error && <p className="form-error">{error}</p>}

        {result && (
          <div className="batch-result-panel">
            <strong>Resumen</strong>
            <p>
              Procesados: {result.successCount}. Fallidos: {result.failedCount}.
            </p>
            {result.failures.length > 0 && (
              <ul>
                {result.failures.map((failure) => (
                  <li key={failure}>{failure}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={saving || selectedAnimals.length === 0}>
            {saving ? 'Finalizando...' : 'Finalizar'}
          </button>
        </div>
      </form>

      <AppModal
        open={Boolean(removeCandidate)}
        title="Quitar animal"
        description={removeCandidate ? `Quitar ${removeCandidate.crotal} de esta lista.` : ''}
        onClose={() => setRemoveCandidate(null)}
      >
        <div className="app-modal-footer">
          <button type="button" className="secondary" onClick={() => setRemoveCandidate(null)}>
            Cancelar
          </button>
          <button type="button" onClick={removeSelectedAnimal}>
            Quitar
          </button>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(pendingRule)}
        title="Automatización encontrada"
        description={pendingRule ? buildRuleQuery(pendingRule.type, pendingRule.rule) : ''}
        onClose={() => setPendingRule(null)}
      >
        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => runOperation(false, pendingRule?.rule)}
          >
            No, solo esto
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => runOperation(true, pendingRule?.rule)}
          >
            Sí, aplicar
          </button>
        </div>
      </AppModal>
    </section>
  );
}
