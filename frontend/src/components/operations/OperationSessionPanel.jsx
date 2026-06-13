import { useMemo, useState } from 'react';
import { post, put } from '../../api/apiClient';
import { useCatalogs } from '../../context/CatalogsContext';
import { useOperationSession } from '../../context/OperationSessionContext';
import AnimalReaderPanel from '../reader/AnimalReaderPanel';
import { OPERATION_BY_KEY, readerActionForOperation } from './operationConfig';

const MODES = [
  { key: 'unitario', label: 'Unitario' },
  { key: 'lote', label: 'Lote' },
  { key: 'corral', label: 'Corral completo' }
];

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function itemName(item, fallback = 'Sin nombre') {
  return item?.nombre || item?.name || item?.codigoRega || fallback;
}

function animalCode(animal) {
  return animal?.crotal || animal?.numeroInterno || '';
}

function getUnknownCodes(session) {
  return (session?.unknownCodes || []).map((item) => item.code || item).filter(Boolean);
}

function getDuplicateCodes(session) {
  return (session?.duplicateCodes || []).map((item) => item.code || item).filter(Boolean);
}

function inferFarmUnitId(session, catalogs) {
  return (
    session?.operationData?.unidadRegaId ||
    session?.selectedAnimals?.[0]?.unidadRegaId ||
    session?.selectedAnimals?.[0]?.unidadRega?.id ||
    session?.selectedPens?.[0]?.unidadRegaId ||
    session?.selectedPens?.[0]?.unidadRega?.id ||
    catalogs.farmUnits?.[0]?.id ||
    ''
  );
}

function movementTypeFromMode(mode) {
  if (mode === 'unitario') return 'INDIVIDUAL';
  if (mode === 'corral') return 'CORRAL_COMPLETO';
  return 'LOTE';
}

function createResultSummary(label, processed, extra = {}) {
  return {
    label,
    processed,
    ...extra
  };
}

function resultText(result) {
  if (!result) return 'Operacion preparada.';
  if (result.label === 'Cambio de corral') {
    const resumen = result.raw?.resumen || {};
    return `Registrado: ${resumen.procesados || 0} procesado(s), ${resumen.noEncontrados || 0} no encontrado(s), ${resumen.duplicadosIgnorados || 0} duplicado(s) ignorado(s).`;
  }
  return `Registrado: ${result.processed || 0} registro(s).`;
}

export default function OperationSessionPanel({
  onPrepared,
  onExecuted,
  onCancelled
}) {
  const {
    session,
    patchSession,
    setMode,
    setOperationData,
    finishReading,
    clearOperation
  } = useOperationSession();
  const { catalogs, loading: catalogsLoading, error: catalogsError } = useCatalogs();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [doneResult, setDoneResult] = useState(null);

  const operation = OPERATION_BY_KEY[session?.operationType] || OPERATION_BY_KEY.corral;
  const operationData = session?.operationData || {};
  const farmUnitId = inferFarmUnitId(session, catalogs);
  const selectedAnimals = session?.selectedAnimals || [];
  const selectedPens = session?.selectedPens || [];
  const unknownCodes = getUnknownCodes(session);
  const duplicateCodes = getDuplicateCodes(session);

  const filteredPens = useMemo(() => {
    if (!farmUnitId) return catalogs.pens || [];
    return (catalogs.pens || []).filter((pen) => Number(pen.unidadRegaId) === Number(farmUnitId));
  }, [catalogs.pens, farmUnitId]);

  const destinationPen = useMemo(() => {
    return (catalogs.pens || []).find((pen) => String(pen.id) === String(operationData.corralDestinoId));
  }, [catalogs.pens, operationData.corralDestinoId]);

  const suggestedStatus = useMemo(() => {
    const statusId = operationData.estadoReproductivoDestinoId || destinationPen?.estadoReproductivoSugeridoId;
    return (catalogs.reproductiveStatuses || []).find((status) => String(status.id) === String(statusId));
  }, [catalogs.reproductiveStatuses, destinationPen, operationData.estadoReproductivoDestinoId]);
  const applySuggestedStatus = operationData.aplicarEstadoReproductivo !== undefined
    ? Boolean(operationData.aplicarEstadoReproductivo)
    : Boolean(destinationPen?.aplicarEstadoAutomaticamente && suggestedStatus);

  if (!session) {
    return null;
  }

  function dataValue(key, fallback = '') {
    if (operationData[key] !== undefined && operationData[key] !== null) {
      return operationData[key];
    }
    if (key === 'fecha') return todayInputValue();
    if (key === 'unidadRegaId') return farmUnitId;
    if (key === 'destinoSalida') return 'Muerte';
    if (key === 'tipoDesparasitacion') return 'Interna';
    return fallback;
  }

  function handleDataChange(event) {
    const { name, value, type, checked } = event.target;
    setOperationData({
      [name]: type === 'checkbox' ? checked : value
    });
  }

  function handleDestinationChange(event) {
    const corralDestinoId = event.target.value;
    const pen = (catalogs.pens || []).find((item) => String(item.id) === String(corralDestinoId));

    setOperationData({
      corralDestinoId,
      estadoReproductivoDestinoId: pen?.estadoReproductivoSugeridoId || '',
      aplicarEstadoReproductivo: Boolean(pen?.aplicarEstadoAutomaticamente && pen?.estadoReproductivoSugeridoId)
    });
  }

  function handleReaderFinish(draft) {
    finishReading(draft);

    const message = buildPreparedMessage({
      animals: draft.animals || [],
      pens: draft.pens || [],
      unknown: draft.unknownCodes || [],
      duplicates: draft.duplicateCodes || []
    });

    onPrepared?.(message);
  }

  function buildPreparedMessage(source = {}) {
    const animals = source.animals || selectedAnimals;
    const pens = source.pens || selectedPens;
    const unknown = (source.unknown || unknownCodes).map((item) => item.code || item);
    const duplicates = (source.duplicates || duplicateCodes).map((item) => item.code || item);
    const destination = destinationPen ? ` Destino: ${itemName(destinationPen)}.` : '';
    const product = operationData.vacuna || operationData.producto || operationData.medicamentoProducto || '';
    const productText = product ? ` Producto: ${product}.` : '';
    const statusText = suggestedStatus ? ` Estado sugerido: ${itemName(suggestedStatus)}.` : '';

    return [
      `${operation.title}: ${animals.length} animal(es), ${pens.length} corral(es).`,
      unknown.length ? `No encontrados: ${unknown.join(', ')}.` : 'No encontrados: 0.',
      duplicates.length ? `Duplicados ignorados: ${duplicates.join(', ')}.` : 'Duplicados ignorados: 0.',
      `${destination}${productText}${statusText}`.trim(),
      'Quieres registrar este cambio?'
    ].filter(Boolean).join('\n');
  }

  function reviewOperation() {
    patchSession({ status: 'confirming' });
    onPrepared?.(buildPreparedMessage());
  }

  function cancelOperation() {
    clearOperation();
    onCancelled?.('Operacion cancelada. No he registrado nada.');
  }

  function getCrotalesForMovement() {
    const knownCodes = selectedAnimals.map(animalCode).filter(Boolean);
    return [...new Set([...knownCodes, ...unknownCodes])];
  }

  function ensureBaseSelection() {
    if (session.mode === 'corral' && selectedPens.length === 0 && selectedAnimals.length === 0) {
      throw new Error('Selecciona al menos un corral o lee animales antes de confirmar.');
    }
    if (session.mode !== 'corral' && selectedAnimals.length === 0 && unknownCodes.length === 0) {
      throw new Error('Lee o selecciona al menos un animal antes de confirmar.');
    }
  }

  function targetAnimalsOnly() {
    if (selectedAnimals.length === 0) {
      throw new Error('Para esta operacion necesito animales identificados. Los crotales no encontrados no se pueden registrar.');
    }
    return selectedAnimals;
  }

  function unitIdForTarget(target) {
    return target?.unidadRegaId || target?.unidadRega?.id || farmUnitId;
  }

  async function executeForAnimals(endpoint, buildPayload) {
    const animals = targetAnimalsOnly();
    const results = [];

    for (const animal of animals) {
      results.push(await post(endpoint, buildPayload({ animal })));
    }

    return results;
  }

  async function executeForPens(endpoint, buildPayload) {
    if (selectedPens.length === 0) {
      return executeForAnimals(endpoint, buildPayload);
    }

    const results = [];

    for (const pen of selectedPens) {
      results.push(await post(endpoint, buildPayload({ pen })));
    }

    return results;
  }

  async function executeOperation() {
    setSaving(true);
    setError('');

    try {
      ensureBaseSelection();

      const fecha = dataValue('fecha');
      const unidadRegaId = Number(dataValue('unidadRegaId'));
      let result;

      if (session.operationType === 'corral') {
        if (!operationData.corralDestinoId) {
          throw new Error('Selecciona el corral destino.');
        }

        const crotales = getCrotalesForMovement();
        if (crotales.length === 0) {
          throw new Error('No hay crotales para mover.');
        }

        const raw = await post('/movements', {
          tipoOperacion: movementTypeFromMode(session.mode),
          motivo: operationData.motivo || 'Movimiento registrado desde flujo guiado',
          fecha,
          unidadRegaId,
          corralDestinoId: Number(operationData.corralDestinoId),
          crotales,
          aplicarEstadoReproductivo: applySuggestedStatus,
          estadoReproductivoDestinoId: (operationData.estadoReproductivoDestinoId || destinationPen?.estadoReproductivoSugeridoId)
            ? Number(operationData.estadoReproductivoDestinoId || destinationPen?.estadoReproductivoSugeridoId)
            : null
        });

        result = createResultSummary('Cambio de corral', raw?.resumen?.procesados || 0, { raw });
      } else if (session.operationType === 'baja') {
        const animals = targetAnimalsOnly();
        const updates = [];
        const destinoSalida = dataValue('destinoSalida', 'Muerte') === 'Otro'
          ? dataValue('destinoSalidaOtro', 'Otro')
          : dataValue('destinoSalida', 'Muerte');
        for (const animal of animals) {
          updates.push(await put(`/animals/${animal.id}`, {
            estadoRegistro: 'BAJA',
            fechaSalida: fecha,
            destinoSalida,
            observaciones: operationData.observaciones || 'Baja registrada desde flujo guiado.'
          }));
        }
        result = createResultSummary('Baja', updates.length, { raw: updates });
      } else if (session.operationType === 'estado_reproductivo') {
        if (!operationData.estadoReproductivoId) {
          throw new Error('Selecciona el estado reproductivo destino.');
        }
        const animals = targetAnimalsOnly();
        const updates = [];
        for (const animal of animals) {
          updates.push(await put(`/animals/${animal.id}`, {
            estadoReproductivoId: Number(operationData.estadoReproductivoId),
            fechaEstadoReproductivoActual: fecha
          }));
        }
        result = createResultSummary('Estado reproductivo', updates.length, { raw: updates });
      } else if (session.operationType === 'sanitario') {
        const registros = await executeForPens('/health-cases', ({ animal, pen }) => ({
          fechaInicio: fecha,
          signosClinicos: operationData.signosClinicos || 'Caso abierto desde flujo guiado.',
          diagnosticoPresuntivo: operationData.diagnosticoPresuntivo || null,
          gravedad: operationData.gravedad || 'Media',
          afectaBienestar: Boolean(operationData.afectaBienestar),
          lazareto: Boolean(operationData.lazareto),
          unidadRegaId: Number(unitIdForTarget(animal || pen)),
          animalId: animal?.id || null,
          corralId: pen?.id || null,
          enfermedadId: operationData.enfermedadId ? Number(operationData.enfermedadId) : null
        }));
        result = createResultSummary('Evento sanitario', registros.length, { raw: registros });
      } else if (session.operationType === 'tratamiento') {
        if (!operationData.medicamentoProducto) {
          throw new Error('Indica el medicamento o producto.');
        }
        const registros = await executeForPens('/treatments', ({ animal, pen }) => ({
          fechaInicio: fecha,
          motivo: operationData.motivo || null,
          medicamentoProducto: operationData.medicamentoProducto,
          dosisTexto: operationData.dosisTexto || null,
          via: operationData.via || null,
          animalId: animal?.id || null,
          corralId: pen?.id || null
        }));
        result = createResultSummary('Tratamiento', registros.length, { raw: registros });
      } else if (session.operationType === 'vacunacion') {
        if (!operationData.vacuna) {
          throw new Error('Indica la vacuna.');
        }
        const registros = await executeForPens('/vaccinations', ({ animal, pen }) => ({
          fecha,
          vacuna: operationData.vacuna,
          loteVacuna: operationData.loteVacuna || null,
          dosisTexto: operationData.dosisTexto || null,
          via: operationData.via || null,
          unidadRegaId: Number(unitIdForTarget(animal || pen)),
          animalId: animal?.id || null,
          corralId: pen?.id || null
        }));
        result = createResultSummary('Vacunacion', registros.length, { raw: registros });
      } else if (session.operationType === 'desparasitacion') {
        if (!operationData.producto) {
          throw new Error('Indica el producto de desparasitacion.');
        }
        const registros = await executeForPens('/dewormings', ({ animal, pen }) => ({
          fecha,
          tipo: operationData.tipoDesparasitacion || 'Interna',
          producto: operationData.producto,
          dosisTexto: operationData.dosisTexto || null,
          via: operationData.via || null,
          motivo: operationData.motivo || null,
          unidadRegaId: Number(unitIdForTarget(animal || pen)),
          animalId: animal?.id || null,
          corralId: pen?.id || null
        }));
        result = createResultSummary('Desparasitacion', registros.length, { raw: registros });
      } else {
        throw new Error('Operacion no soportada todavia.');
      }

      setDoneResult(result);
      patchSession({ status: 'done', message: resultText(result) });
      onExecuted?.(resultText(result), result);
    } catch (err) {
      setError(err.message);
      patchSession({ status: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const canReview = selectedAnimals.length > 0 || selectedPens.length > 0 || unknownCodes.length > 0;
  const showConfirm = ['ready', 'confirming', 'error'].includes(session.status);
  const actionRequest = {
    actionType: readerActionForOperation(session.operationType),
    preferredMode: session.mode,
    data: {
      draft: {
        preferred_mode: session.mode
      }
    }
  };

  return (
    <section className="operation-panel" aria-label="Operación guiada">
      <div className="operation-panel-header">
        <div>
          <p className="eyebrow">Operación guiada</p>
          <h3>{operation.title}</h3>
          <p>Lee animales, revisa el resumen y confirma antes de registrar.</p>
        </div>

        <button type="button" className="secondary" onClick={cancelOperation}>
          Cerrar
        </button>
      </div>

      {catalogsLoading && <p className="muted">Cargando catálogos...</p>}
      {catalogsError && <p className="alert error">Error catálogos: {catalogsError}</p>}

      <div className="operation-mode-tabs" role="tablist" aria-label="Modo de operación">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            className={session.mode === mode.key ? 'active' : ''}
            onClick={() => setMode(mode.key)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="operation-data-grid">
        <label>
          Fecha
          <input
            type="date"
            name="fecha"
            value={dataValue('fecha')}
            onChange={handleDataChange}
          />
        </label>

        <label>
          Unidad REGA
          <select
            name="unidadRegaId"
            value={dataValue('unidadRegaId')}
            onChange={handleDataChange}
          >
            <option value="">Selecciona unidad</option>
            {(catalogs.farmUnits || []).map((unit) => (
              <option key={unit.id} value={unit.id}>
                {itemName(unit)}
              </option>
            ))}
          </select>
        </label>

        {session.operationType === 'corral' && (
          <>
            <label>
              Corral destino
              <select
                name="corralDestinoId"
                value={dataValue('corralDestinoId')}
                onChange={handleDestinationChange}
              >
                <option value="">Selecciona corral</option>
                {filteredPens.map((pen) => (
                  <option key={pen.id} value={pen.id}>
                    {itemName(pen)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Motivo
              <input
                name="motivo"
                value={dataValue('motivo', 'Movimiento de manejo')}
                onChange={handleDataChange}
                placeholder="Ej: paso a secado"
              />
            </label>
          </>
        )}

        {session.operationType === 'estado_reproductivo' && (
          <label>
            Estado destino
            <select
              name="estadoReproductivoId"
              value={dataValue('estadoReproductivoId')}
              onChange={handleDataChange}
            >
              <option value="">Selecciona estado</option>
              {(catalogs.reproductiveStatuses || []).map((status) => (
                <option key={status.id} value={status.id}>
                  {itemName(status)}
                </option>
              ))}
            </select>
          </label>
        )}

        {session.operationType === 'sanitario' && (
          <>
            <label>
              Síntomas
              <input
                name="signosClinicos"
                value={dataValue('signosClinicos')}
                onChange={handleDataChange}
                placeholder="Diarrea, cojera, fiebre..."
              />
            </label>
            <label>
              Gravedad
              <select name="gravedad" value={dataValue('gravedad', 'Media')} onChange={handleDataChange}>
                <option value="Leve">Leve</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </label>
            <label>
              Enfermedad
              <select name="enfermedadId" value={dataValue('enfermedadId')} onChange={handleDataChange}>
                <option value="">Sin cerrar diagnóstico</option>
                {(catalogs.diseases || []).map((disease) => (
                  <option key={disease.id} value={disease.id}>
                    {itemName(disease)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {session.operationType === 'tratamiento' && (
          <>
            <label>
              Medicamento / producto
              <input
                name="medicamentoProducto"
                value={dataValue('medicamentoProducto')}
                onChange={handleDataChange}
                placeholder="Producto"
              />
            </label>
            <label>
              Dosis
              <input name="dosisTexto" value={dataValue('dosisTexto')} onChange={handleDataChange} />
            </label>
            <label>
              Via
              <input name="via" value={dataValue('via')} onChange={handleDataChange} />
            </label>
          </>
        )}

        {session.operationType === 'vacunacion' && (
          <>
            <label>
              Vacuna
              <input name="vacuna" value={dataValue('vacuna')} onChange={handleDataChange} />
            </label>
            <label>
              Lote vacuna
              <input name="loteVacuna" value={dataValue('loteVacuna')} onChange={handleDataChange} />
            </label>
            <label>
              Dosis
              <input name="dosisTexto" value={dataValue('dosisTexto')} onChange={handleDataChange} />
            </label>
          </>
        )}

        {session.operationType === 'desparasitacion' && (
          <>
            <label>
              Tipo
              <select
                name="tipoDesparasitacion"
                value={dataValue('tipoDesparasitacion', 'Interna')}
                onChange={handleDataChange}
              >
                <option value="Interna">Interna</option>
                <option value="Externa">Externa</option>
                <option value="Coccidiosis">Coccidiosis</option>
                <option value="Otra">Otra</option>
              </select>
            </label>
            <label>
              Producto
              <input name="producto" value={dataValue('producto')} onChange={handleDataChange} />
            </label>
            <label>
              Dosis
              <input name="dosisTexto" value={dataValue('dosisTexto')} onChange={handleDataChange} />
            </label>
          </>
        )}

        {session.operationType === 'baja' && (
          <>
            <label>
              Motivo de baja
              <select
                name="destinoSalida"
                value={dataValue('destinoSalida', 'Muerte')}
                onChange={handleDataChange}
              >
                <option value="Muerte">Muerte</option>
                <option value="Venta / traslado">Venta / traslado</option>
                <option value="Sacrificio">Sacrificio</option>
                <option value="Desaparecido">Desaparecido</option>
                <option value="Otro">Otro</option>
              </select>
            </label>
            {dataValue('destinoSalida', 'Muerte') === 'Otro' && (
              <label>
                Otra causa
                <input
                  name="destinoSalidaOtro"
                  value={dataValue('destinoSalidaOtro')}
                  onChange={handleDataChange}
                  placeholder="Indica la causa"
                />
              </label>
            )}
            <label>
              Causa / observaciones
              <input
                name="observaciones"
                value={dataValue('observaciones')}
                onChange={handleDataChange}
                placeholder="Sin causa indicada"
              />
            </label>
          </>
        )}
      </div>

      {session.operationType === 'corral' && suggestedStatus && (
        <label className="operation-checkbox">
          <input
            type="checkbox"
            name="aplicarEstadoReproductivo"
            checked={applySuggestedStatus}
            onChange={handleDataChange}
          />
          <span>Aplicar cambio de estado reproductivo a: {itemName(suggestedStatus)}</span>
        </label>
      )}

      <AnimalReaderPanel
        compact
        title="Lector"
        subtitle="Pasa crotales o selecciona corrales. Los repetidos se ignoran."
        initialMode={session.mode}
        actionRequest={actionRequest}
        hideActionSelect
        onFinish={handleReaderFinish}
      />

      <div className="operation-summary">
        <strong>Resumen actual</strong>
        <span>{selectedAnimals.length} animal(es) encontrados</span>
        <span>{selectedPens.length} corral(es)</span>
        <span>{unknownCodes.length} no encontrado(s)</span>
        <span>{duplicateCodes.length} duplicado(s) ignorado(s)</span>
      </div>

      {showConfirm && (
        <div className="operation-confirm">
          <strong>Confirmacion final</strong>
          <p>{buildPreparedMessage()}</p>
        </div>
      )}

      {doneResult && (
        <p className="alert">{resultText(doneResult)}</p>
      )}

      {error && <p className="alert error">Error: {error}</p>}

      <div className="operation-actions">
        <button type="button" className="secondary" onClick={reviewOperation} disabled={!canReview || saving}>
          Revisar y confirmar
        </button>
        <button type="button" onClick={executeOperation} disabled={!showConfirm || saving}>
          {saving ? 'Registrando...' : 'Confirmar y registrar'}
        </button>
        <button type="button" className="secondary" onClick={cancelOperation} disabled={saving}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
