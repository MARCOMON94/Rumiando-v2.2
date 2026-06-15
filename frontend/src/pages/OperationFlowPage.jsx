import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post } from '../api/apiClient';
import { useCatalogs } from '../context/CatalogsContext';
import AppModal from '../components/ui/AppModal';
import useReaderCapture from '../hooks/useReaderCapture';

const SILENT_READER_STATE_EVENT = 'rumiando:silent-reader:state';
const AI_DRAFT_STORAGE_PREFIX = 'rumiando-ai-draft:';

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
    title: 'Evento sanitario',
    description: 'Registra vacunación, enfermedad, desparasitación u otro evento para los animales leídos.'
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
  ['deworming', 'Desparasitación'],
  ['disease', 'Enfermedad'],
  ['other', 'Otro']
];

const DEWORMING_TYPE_LABELS = {
  INTERNA: 'Interna',
  EXTERNA: 'Externa',
  MIXTA: 'Mixta'
};

const VIA_OPTIONS = [
  'Oral',
  'Subcutánea',
  'Intramuscular',
  'Intravenosa',
  'Tópica',
  'Pour-on',
  'Ocular',
  'Otra'
];

const OTHER_VALUE = '__OTHER__';

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function createInitialFormData() {
  return {
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
    vacunaId: '',
    vacunaTexto: '',
    loteVacuna: '',
    dosisTexto: '',
    via: '',
    enfermedadId: '',
    enfermedadTexto: '',
    gravedad: 'LEVE',
    signosClinicos: '',
    desparasitanteId: '',
    desparasitanteTexto: '',
    desparasitacionTipo: 'INTERNA',
    otroSanitarioTexto: ''
  };
}

function normalizeCode(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function animalPenName(animal) {
  return animal?.corralActual?.nombre || animal?.corralActual?.name || 'Sin corral';
}

function animalUnitId(animal) {
  return Number(animal?.unidadRegaId || animal?.unidadRega?.id || 0);
}

function animalSpeciesId(animal) {
  return Number(animal?.especieId || animal?.especie?.id || 0);
}

function animalSpeciesName(animal) {
  return itemName(animal?.especie, '');
}

function itemName(item, fallback = 'Sin nombre') {
  return item?.nombre || item?.name || item?.codigoRega || fallback;
}

function itemMatchesAlias(item, aliases = []) {
  const name = normalizeText(itemName(item, ''));
  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return normalizedAlias && (
      name === normalizedAlias
      || name.includes(normalizedAlias)
      || normalizedAlias.includes(name)
    );
  });
}

function penAliases(alias) {
  const normalized = normalizeText(alias);
  const base = [normalized, alias].filter(Boolean);
  const known = {
    produccion: ['produccion', 'productoras', 'lactacion', 'lactancia', 'ordenio', 'ordeno'],
    lactacion: ['produccion', 'productoras', 'lactacion', 'lactancia'],
    lactancia: ['produccion', 'productoras', 'lactacion', 'lactancia'],
    paridera: ['paridera', 'paridas', 'partos'],
    paridas: ['paridera', 'paridas', 'partos'],
    gestantes: ['gestantes', 'prenadas', 'preñadas'],
    secado: ['secado', 'secas', 'seca'],
    cebo: ['cebo'],
    reposicion: ['reposicion', 'recria'],
    lazareto: ['lazareto', 'enfermeria']
  };
  return [...new Set([...(known[normalized] || []), ...base])].filter(Boolean);
}

function statusAliases(alias) {
  const normalized = normalizeText(alias);
  const known = {
    gestante: ['gestante', 'gestantes', 'prenada', 'preñada'],
    produccion: ['produccion', 'productora', 'lactacion', 'lactancia'],
    productora: ['produccion', 'productora', 'lactacion', 'lactancia'],
    seca: ['seca', 'secado'],
    lactante: ['lactante', 'cria'],
    parida: ['parida', 'paridas']
  };
  return [...new Set([...(known[normalized] || []), normalized, alias].filter(Boolean))];
}

function findByAlias(items, alias, aliasBuilder = (value) => [value]) {
  if (!alias) return null;
  const aliases = aliasBuilder(alias);
  return (items || []).find((item) => itemMatchesAlias(item, aliases)) || null;
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

function draftStorageKey(operationType) {
  return `rumiando-operation-draft:${operationType}`;
}

function filterBySpecies(items, speciesId) {
  if (!speciesId) return items || [];
  return (items || []).filter((item) => {
    const itemSpeciesId = Number(item.especieId || item.especie?.id || 0);
    return !itemSpeciesId || itemSpeciesId === Number(speciesId);
  });
}

function dewormingTypeToBackend(value) {
  return DEWORMING_TYPE_LABELS[value] || value || 'Interna';
}

export default function OperationFlowPage() {
  const { type } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const operationType = OPERATION_META[type] ? type : 'movement';
  const meta = OPERATION_META[operationType];
  const embedded = searchParams.get('embedded') === '1';
  const { catalogs, loading: loadingCatalogs, error: catalogsError, loadCatalogs } = useCatalogs();

  const readerInputRef = useRef(null);
  const readerBufferRef = useRef('');
  const readerTimerRef = useRef(null);
  const restoredDraftRef = useRef(false);
  const appliedAiDraftRef = useRef(false);
  const silentReaderActiveRef = useRef(false);
  const operationInFlightRef = useRef(false);

  const [animals, setAnimals] = useState([]);
  const [rules, setRules] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  const [readerMessage, setReaderMessage] = useState('Pasa crotales y se irán añadiendo a la lista.');
  const [removeCandidate, setRemoveCandidate] = useState(null);
  const [pendingRule, setPendingRule] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [pendingNormalization, setPendingNormalization] = useState(null);
  const [result, setResult] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  const [readerActivationFallback, setReaderActivationFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(createInitialFormData);
  const [aiDraftMeta, setAiDraftMeta] = useState(null);

  useEffect(() => {
    function handleSilentReaderState(event) {
      silentReaderActiveRef.current = Boolean(event.detail?.active);
    }

    window.addEventListener(SILENT_READER_STATE_EVENT, handleSilentReaderState);

    return () => {
      window.removeEventListener(SILENT_READER_STATE_EVENT, handleSilentReaderState);
    };
  }, []);

  const activeAnimals = useMemo(() => (
    animals.filter((animal) => animal.estadoRegistro !== 'BAJA')
  ), [animals]);

  const animalsByCode = useMemo(() => {
    const map = new Map();
    for (const animal of animals) {
      for (const value of [animal?.crotal, animal?.numeroInterno]) {
        const code = normalizeCode(value);
        if (code) map.set(code, animal);
      }
    }
    return map;
  }, [animals]);

  const activeSpeciesId = useMemo(() => (
    animalSpeciesId(selectedAnimals[0])
  ), [selectedAnimals]);

  const filteredPens = useMemo(() => {
    if (!formData.unidadRegaId) return catalogs.pens || [];

    return (catalogs.pens || []).filter((pen) => (
      Number(pen.unidadRegaId || pen.unidadRega?.id) === Number(formData.unidadRegaId)
    ));
  }, [catalogs.pens, formData.unidadRegaId]);

  const vaccineOptions = useMemo(() => (
    filterBySpecies(catalogs.vaccines || [], activeSpeciesId)
  ), [catalogs.vaccines, activeSpeciesId]);

  const diseaseOptions = useMemo(() => (
    filterBySpecies(catalogs.diseases || [], activeSpeciesId)
  ), [catalogs.diseases, activeSpeciesId]);

  const dewormerOptions = useMemo(() => (
    filterBySpecies(catalogs.dewormers || [], activeSpeciesId)
  ), [catalogs.dewormers, activeSpeciesId]);

  const selectedCrotales = useMemo(() => (
    selectedAnimals
      .map((animal) => animal.crotal || animal.numeroInterno)
      .filter(Boolean)
  ), [selectedAnimals]);

  const aiDraftTargetText = useMemo(() => {
    if (!aiDraftMeta) return '';
    const parts = [];
    if (aiDraftMeta.expectedCount) {
      parts.push(`${selectedAnimals.length}/${aiDraftMeta.expectedCount}`);
    }
    if (aiDraftMeta.expectedSpecies) {
      parts.push(aiDraftMeta.expectedSpecies);
    }
    if (operationType === 'movement' && (aiDraftMeta.targetPenName || aiDraftMeta.corralDestinoAlias)) {
      parts.push(`a ${aiDraftMeta.targetPenName || aiDraftMeta.corralDestinoAlias}`);
    }
    return parts.join(' ');
  }, [aiDraftMeta, operationType, selectedAnimals.length]);

  const aiSpeciesMismatchCount = useMemo(() => {
    if (!aiDraftMeta?.expectedSpecies || selectedAnimals.length === 0) return 0;
    const expected = normalizeText(aiDraftMeta.expectedSpecies);
    return selectedAnimals.filter((animal) => {
      const name = normalizeText(animalSpeciesName(animal));
      return name && expected && !name.includes(expected.replace(/s$/, '')) && !expected.includes(name);
    }).length;
  }, [aiDraftMeta, selectedAnimals]);

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

  const shouldBlockNavigation = selectedAnimals.length > 0 && !result;

  const focusReader = useCallback(function focusReader(attempt = 0) {
    window.setTimeout(() => {
      if (embedded) {
        window.focus();
      }
      const target = readerInputRef.current;
      if (!target) return;

      target.focus({ preventScroll: true });
      if (document.activeElement === target) {
        setReaderActivationFallback(false);
        return;
      }

      if (attempt < 3) {
        focusReader(attempt + 1);
      }
    }, attempt === 0 ? 0 : 70);
  }, [embedded]);

  const resetReaderBuffer = useCallback(function resetReaderBuffer() {
    window.clearTimeout(readerTimerRef.current);
    readerBufferRef.current = '';
  }, []);

  const setField = useCallback(function setField(name, value) {
    setFormData((current) => {
      const next = {
        ...current,
        [name]: value
      };

      if (name === 'tipoEvento' && value === 'DIAGNOSTICO_GESTACION' && current.resultado === 'NO_APLICA') {
        next.resultado = 'POSITIVO';
      }

      if (name === 'sourcePenId') {
        const pen = (catalogs.pens || []).find((item) => String(item.id) === String(value));
        if (pen) {
          next.unidadRegaId = String(pen.unidadRegaId || pen.unidadRega?.id || '');
        }
      }

      if (name === 'corralDestinoId' && !current.unidadRegaId) {
        const pen = (catalogs.pens || []).find((item) => String(item.id) === String(value));
        if (pen) {
          next.unidadRegaId = String(pen.unidadRegaId || pen.unidadRega?.id || '');
        }
      }

      if (name === 'enfermedadId' && value && value !== OTHER_VALUE) {
        const disease = (catalogs.diseases || []).find((item) => String(item.id) === String(value));
        if (disease?.gravedadSugerida) {
          next.gravedad = disease.gravedadSugerida;
        }
      }

      if (name === 'desparasitanteId' && value && value !== OTHER_VALUE) {
        const dewormer = (catalogs.dewormers || []).find((item) => String(item.id) === String(value));
        if (dewormer?.tipo) {
          next.desparasitacionTipo = dewormer.tipo;
        }
      }

      return next;
    });
  }, [catalogs.dewormers, catalogs.diseases, catalogs.pens]);

  const addCodes = useCallback(function addCodes(rawCodes) {
    const codes = Array.isArray(rawCodes) ? rawCodes : extractCodes(rawCodes);
    if (!codes.length) return;

    setResult(null);
    setError('');

    let addedCount = 0;
    let duplicateCount = 0;
    let unknownCount = 0;
    let inactiveCount = 0;
    let wrongUnitCount = 0;

    setSelectedAnimals((current) => {
      const next = [...current];
      let inferredUnitId = formData.unidadRegaId;

      for (const code of codes) {
        const animal = animalsByCode.get(normalizeCode(code));

        if (!animal) {
          unknownCount++;
          continue;
        }

        if (animal.estadoRegistro === 'BAJA') {
          inactiveCount++;
          continue;
        }

        if (inferredUnitId && animalUnitId(animal) !== Number(inferredUnitId)) {
          wrongUnitCount++;
          continue;
        }

        if (!inferredUnitId) {
          inferredUnitId = String(animalUnitId(animal) || '');
        }

        if (next.some((item) => item.id === animal.id)) {
          duplicateCount++;
          continue;
        }

        next.push(animal);
        addedCount++;
      }

      if (!formData.unidadRegaId && inferredUnitId) {
        setFormData((currentForm) => ({
          ...currentForm,
          unidadRegaId: inferredUnitId
        }));
      }

      return next;
    });

    const parts = [];
    if (addedCount) parts.push(`${addedCount} añadido${addedCount === 1 ? '' : 's'}`);
    if (duplicateCount) parts.push(`${duplicateCount} repetido${duplicateCount === 1 ? '' : 's'}`);
    if (unknownCount) parts.push(`${unknownCount} no encontrado${unknownCount === 1 ? '' : 's'}`);
    if (inactiveCount) parts.push(`${inactiveCount} dado${inactiveCount === 1 ? '' : 's'} de baja/no activo${inactiveCount === 1 ? '' : 's'}`);
    if (wrongUnitCount) parts.push(`${wrongUnitCount} de otra REGA`);

    setReaderMessage(parts.length ? parts.join(' · ') : 'Pasa crotales y se irán añadiendo a la lista.');
    if (addedCount > 0) {
      setFlashKey((current) => current + 1);
    }
    focusReader();
  }, [animalsByCode, focusReader, formData.unidadRegaId]);

  const flushReaderBuffer = useCallback(function flushReaderBuffer() {
    const raw = readerBufferRef.current;
    resetReaderBuffer();
    addCodes(extractCodes(raw));
  }, [addCodes, resetReaderBuffer]);

  const handleReaderKeyDown = useCallback(function handleReaderKeyDown(event) {
    const finishKey = event.key === 'Enter' || event.key === 'Tab';
    const characterKey = event.key.length === 1;

    if (!finishKey && !characterKey && event.key !== 'Backspace') return false;

    event.preventDefault();

    if (finishKey) {
      flushReaderBuffer();
      return true;
    }

    if (event.key === 'Backspace') {
      readerBufferRef.current = readerBufferRef.current.slice(0, -1);
      return true;
    }

    readerBufferRef.current += event.key;
    window.clearTimeout(readerTimerRef.current);
    readerTimerRef.current = window.setTimeout(flushReaderBuffer, 180);
    return true;
  }, [flushReaderBuffer]);

  const handleReaderInput = useCallback(function handleReaderInput(event) {
    if (silentReaderActiveRef.current) return;

    const value = event.currentTarget.value;
    event.currentTarget.value = '';

    if (value) {
      resetReaderBuffer();
      addCodes(extractCodes(value));
    }
  }, [addCodes, resetReaderBuffer]);

  useReaderCapture({
    active: true,
    delay: 160,
    extractCodes,
    onCodes: addCodes,
    shouldCaptureIgnoredPaste: (pasted) => extractCodes(pasted).length > 0,
    shouldPause: () => silentReaderActiveRef.current
  });

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      setError('');

      try {
        const [animalsData, rulesData] = await Promise.all([
          get('/animals'),
          get('/management-rules?activo=true')
        ]);

        const loadedAnimals = getItems(animalsData, ['data', 'animals', 'animales']);

        setAnimals(loadedAnimals);
        setRules(getItems(rulesData, ['data', 'rules']));
        setReaderMessage('Pasa crotales y se irán añadiendo a la lista.');
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
    if (loadingData || restoredDraftRef.current) return;

    restoredDraftRef.current = true;

    try {
      const saved = window.sessionStorage.getItem(draftStorageKey(operationType));
      if (!saved) return;

      const parsed = JSON.parse(saved);
      setFormData({
        ...createInitialFormData(),
        ...(parsed.formData || {}),
        fecha: todayInputValue()
      });

      const ids = new Set((parsed.selectedAnimalIds || []).map(Number));
      if (ids.size) {
        setSelectedAnimals(activeAnimals.filter((animal) => ids.has(Number(animal.id))));
        setReaderMessage(`${ids.size} animales restaurados de la lista anterior.`);
      }
    } catch {
      window.sessionStorage.removeItem(draftStorageKey(operationType));
    }
  }, [activeAnimals, loadingData, operationType]);

  useEffect(() => {
    if (loadingData || loadingCatalogs || appliedAiDraftRef.current) return;

    const draftId = searchParams.get('aiDraft');
    if (!draftId) return;

    appliedAiDraftRef.current = true;

    try {
      const key = `${AI_DRAFT_STORAGE_PREFIX}${draftId}`;
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;

      const draft = JSON.parse(raw);
      setAiDraftMeta(draft);

      setFormData((current) => {
        const next = { ...current };

        if (operationType === 'movement') {
          if (draft.motivo) next.motivo = draft.motivo;

          const targetPenId = draft.corralDestinoId || draft.corral_destino_id;
          if (targetPenId) {
            next.corralDestinoId = String(targetPenId);
          } else {
            const aliases = penAliases(draft.targetPenName || draft.corralDestinoAlias || draft.destination);
            const matches = (catalogs.pens || []).filter((pen) => itemMatchesAlias(pen, aliases));
            if (matches.length === 1) {
              next.corralDestinoId = String(matches[0].id);
              next.unidadRegaId = String(matches[0].unidadRegaId || matches[0].unidadRega?.id || '');
            }
          }
        }

        if (operationType === 'reproductive') {
          if (draft.tipoEvento) next.tipoEvento = draft.tipoEvento;
          if (draft.resultado) next.resultado = draft.resultado;
          if (draft.semanasGestacion) next.semanasGestacion = String(draft.semanasGestacion);
          if (draft.estadoResultanteId) {
            next.estadoResultanteId = String(draft.estadoResultanteId);
          } else if (draft.estadoResultanteAlias) {
            const status = findByAlias(
              catalogs.reproductiveStatuses || [],
              draft.estadoResultanteAlias,
              statusAliases
            );
            if (status?.id) next.estadoResultanteId = String(status.id);
          }
        }

        if (operationType === 'health') {
          if (draft.healthType) next.healthType = draft.healthType;
          if (draft.fullPen !== undefined) next.fullPen = Boolean(draft.fullPen);
          if (draft.vacunaTexto) {
            next.vacunaId = OTHER_VALUE;
            next.vacunaTexto = draft.vacunaTexto;
          }
          if (draft.enfermedadTexto) {
            next.enfermedadId = OTHER_VALUE;
            next.enfermedadTexto = draft.enfermedadTexto;
          }
          if (draft.desparasitanteTexto) {
            next.desparasitanteId = OTHER_VALUE;
            next.desparasitanteTexto = draft.desparasitanteTexto;
          }
          if (draft.otroSanitarioTexto) next.otroSanitarioTexto = draft.otroSanitarioTexto;
          if (draft.dosisTexto) next.dosisTexto = draft.dosisTexto;
          if (draft.via) next.via = draft.via;
          if (draft.gravedad) next.gravedad = draft.gravedad;
        }

        return next;
      });

      if (Array.isArray(draft.crotales) && draft.crotales.length) {
        addCodes(draft.crotales);
      } else {
        setReaderMessage('Pasa crotales y se irán añadiendo a la lista.');
      }

      window.sessionStorage.removeItem(key);
      focusReader();
    } catch {
      setAiDraftMeta(null);
      focusReader();
    }
  }, [
    addCodes,
    catalogs.pens,
    catalogs.reproductiveStatuses,
    focusReader,
    loadingCatalogs,
    loadingData,
    operationType,
    searchParams
  ]);

  useEffect(() => {
    if (loadingCatalogs || loadingData) return;
    focusReader();
  }, [focusReader, loadingCatalogs, loadingData, operationType]);

  useEffect(() => {
    if (loadingCatalogs || loadingData) return undefined;

    setReaderActivationFallback(false);
    focusReader();

    const timer = window.setTimeout(() => {
      const target = readerInputRef.current;
      const activeElement = document.activeElement;
      const activeIsManualField = activeElement?.closest?.(
        'input:not([data-reader-capture="true"]), textarea, select, [contenteditable="true"]'
      );

      if (
        !embedded
        && target
        && activeElement !== target
        && !activeIsManualField
        && !silentReaderActiveRef.current
      ) {
        setReaderActivationFallback(true);
        return;
      }

      if (embedded && !document.hasFocus() && !activeIsManualField && !silentReaderActiveRef.current) {
        setReaderActivationFallback(true);
      }
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [embedded, focusReader, loadingCatalogs, loadingData, operationType]);

  useEffect(() => {
    if (!restoredDraftRef.current) return;

    if (selectedAnimals.length === 0) {
      window.sessionStorage.removeItem(draftStorageKey(operationType));
      return;
    }

    window.sessionStorage.setItem(draftStorageKey(operationType), JSON.stringify({
      formData,
      selectedAnimalIds: selectedAnimals.map((animal) => animal.id)
    }));
  }, [formData, operationType, selectedAnimals]);

  useEffect(() => {
    if (!formData.unidadRegaId) return;

    const penMatchesUnit = (penId) => filteredPens.some((pen) => String(pen.id) === String(penId));

    setFormData((current) => {
      const next = { ...current };
      if (current.corralDestinoId && !penMatchesUnit(current.corralDestinoId)) {
        next.corralDestinoId = '';
      }
      if (current.sourcePenId && !penMatchesUnit(current.sourcePenId)) {
        next.sourcePenId = '';
      }
      return next;
    });
  }, [filteredPens, formData.unidadRegaId]);

  useEffect(() => {
    if (operationType !== 'movement' || formData.corralDestinoId) return;
    const target = aiDraftMeta?.targetPenName || aiDraftMeta?.corralDestinoAlias || aiDraftMeta?.destination;
    if (!target) return;

    const match = findByAlias(filteredPens, target, penAliases);
    if (match?.id) {
      setFormData((current) => ({
        ...current,
        corralDestinoId: String(match.id)
      }));
    }
  }, [
    aiDraftMeta,
    filteredPens,
    formData.corralDestinoId,
    operationType
  ]);

  useEffect(() => {
    if (operationType !== 'health' || !formData.fullPen || !formData.sourcePenId) return;

    const penAnimals = activeAnimals.filter((animal) => (
      Number(animal.corralActualId || animal.corralActual?.id) === Number(formData.sourcePenId)
    ));

    setSelectedAnimals(penAnimals);
    setReaderMessage(
      penAnimals.length > 0
        ? 'Corral completo preparado. Revisa la lista abajo.'
        : 'Ese corral no tiene animales activos.'
    );
  }, [activeAnimals, formData.fullPen, formData.sourcePenId, operationType]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!shouldBlockNavigation) return;
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [shouldBlockNavigation]);

  useEffect(() => {
    function handleNavigationRequest(event) {
      if (!shouldBlockNavigation) return;

      const to = String(event.detail?.to || '');
      if (to.startsWith('/animals/') && to.includes('preview=1')) return;

      event.preventDefault();
      event.stopImmediatePropagation?.();
      setPendingNavigation({
        proceed: event.detail?.proceed || null
      });
    }

    window.addEventListener('rumiando:navigation-request', handleNavigationRequest);

    return () => {
      window.removeEventListener('rumiando:navigation-request', handleNavigationRequest);
    };
  }, [shouldBlockNavigation]);

  function handleChange(event) {
    const { name, type: inputType, checked, value, tagName } = event.target;
    const shouldRestoreReaderFocus = tagName === 'SELECT' || inputType === 'checkbox';
    setField(name, inputType === 'checkbox' ? checked : value);
    if (shouldRestoreReaderFocus) {
      focusReader();
    }
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

    if (!formData.unidadRegaId) {
      throw new Error('Lee un animal para tomar su unidad REGA.');
    }
  }

  function buildSummary(successCount, failures) {
    const summary = {
      successCount,
      failedCount: failures.length,
      failures
    };

    setResult(summary);
    window.sessionStorage.removeItem(draftStorageKey(operationType));
    return summary;
  }

  function closeOperationAfterSuccess() {
    setSelectedAnimals([]);
    setResult(null);
    setReaderMessage('Pasa crotales y se irán añadiendo a la lista.');

    if (embedded && window.parent && window.parent !== window) {
      window.setTimeout(() => {
        window.parent.postMessage({
          type: 'rumiando:ai-operation-complete',
          operationType
        }, window.location.origin);
      }, 120);
      return;
    }

    const target = location.state?.returnTo
      || (location.state?.fromAiChat ? '/ai-chat' : '/home');

    window.setTimeout(() => {
      navigate(target, { replace: true });
    }, 120);
  }

  function findById(items, id) {
    return (items || []).find((item) => String(item.id) === String(id)) || null;
  }

  function getManualHealthText() {
    if (formData.healthType === 'vaccination' && formData.vacunaId === OTHER_VALUE) {
      return formData.vacunaTexto.trim();
    }
    if (formData.healthType === 'deworming' && formData.desparasitanteId === OTHER_VALUE) {
      return formData.desparasitanteTexto.trim();
    }
    if (formData.healthType === 'disease' && formData.enfermedadId === OTHER_VALUE) {
      return formData.enfermedadTexto.trim();
    }
    if (formData.healthType === 'other') {
      return formData.otroSanitarioTexto.trim();
    }
    return '';
  }

  function normalizationType() {
    if (formData.healthType === 'other') return 'disease';
    return formData.healthType;
  }

  async function requestHealthNormalization({ createIfMissing = false } = {}) {
    const text = getManualHealthText();
    if (!text) return null;

    return post('/catalogs/sanitary-normalize', {
      type: normalizationType(),
      text,
      especieId: activeSpeciesId || null,
      gravedad: formData.gravedad,
      dewormingType: formData.desparasitacionTipo,
      createIfMissing
    });
  }

  async function prepareHealthNormalization() {
    if (operationType !== 'health') return true;

    const needsManualNormalization = (
      (formData.healthType === 'vaccination' && formData.vacunaId === OTHER_VALUE)
      || (formData.healthType === 'deworming' && formData.desparasitanteId === OTHER_VALUE)
      || (formData.healthType === 'disease' && formData.enfermedadId === OTHER_VALUE)
      || formData.healthType === 'other'
    );

    if (!needsManualNormalization) return true;

    const text = getManualHealthText();
    if (!text) {
      throw new Error('Indica el nombre o motivo del evento sanitario.');
    }

    const normalized = await requestHealthNormalization({ createIfMissing: false });

    if (normalized?.status === 'suggested' && normalized.item) {
      setPendingNormalization({
        text,
        item: normalized.item,
        source: normalized.source
      });
      return false;
    }

    if (normalized?.status === 'matched' && normalized.item) {
      await runOperation(false, null, normalized.item);
      return false;
    }

    const created = await requestHealthNormalization({ createIfMissing: true });
    await runOperation(false, null, created?.item || null);
    return false;
  }

  function healthPayloadForAnimal(animal, normalizedItem = null) {
    const corralId = animal.corralActualId || animal.corralActual?.id || formData.sourcePenId || null;
    const unitId = Number(formData.unidadRegaId);

    if (formData.healthType === 'vaccination') {
      const selected = normalizedItem || findById(vaccineOptions, formData.vacunaId);
      return {
        endpoint: '/vaccinations',
        body: {
          fecha: formData.fecha,
          vacuna: selected?.nombre || formData.vacunaTexto,
          loteVacuna: formData.loteVacuna || null,
          dosisTexto: formData.dosisTexto || null,
          via: formData.via || null,
          unidadRegaId: unitId,
          animalId: animal.id,
          corralId
        }
      };
    }

    if (formData.healthType === 'deworming') {
      const selected = normalizedItem || findById(dewormerOptions, formData.desparasitanteId);
      return {
        endpoint: '/dewormings',
        body: {
          fecha: formData.fecha,
          tipo: dewormingTypeToBackend(selected?.tipo || formData.desparasitacionTipo),
          producto: selected?.nombre || formData.desparasitanteTexto,
          principioActivo: selected?.principioActivo || null,
          dosisTexto: formData.dosisTexto || null,
          via: formData.via || null,
          motivo: formData.motivo || null,
          unidadRegaId: unitId,
          animalId: animal.id,
          corralId
        }
      };
    }

    const selectedDisease = normalizedItem || findById(diseaseOptions, formData.enfermedadId);
    const diagnosis = selectedDisease?.nombre || formData.enfermedadTexto || formData.otroSanitarioTexto;
    return {
      endpoint: '/health-cases',
      body: {
        fechaInicio: formData.fecha,
        signosClinicos: formData.signosClinicos || formData.otroSanitarioTexto || null,
        diagnosticoPresuntivo: diagnosis || 'Evento sanitario registrado desde lector',
        gravedad: selectedDisease?.gravedadSugerida || formData.gravedad || null,
        unidadRegaId: unitId,
        animalId: animal.id,
        corralId,
        enfermedadId: selectedDisease?.id || null
      }
    };
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

    return buildSummary(successCount, failures);
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

    return buildSummary(successCount || selectedAnimals.length - failures.length, failures);
  }

  async function createHealthRecords(normalizedItem = null) {
    const failures = [];
    let successCount = 0;

    for (const animal of selectedAnimals) {
      try {
        const payload = healthPayloadForAnimal(animal, normalizedItem);
        await post(payload.endpoint, payload.body);
        successCount++;
      } catch (err) {
        failures.push(`${animal.crotal}: ${err.message}`);
      }
    }

    return buildSummary(successCount, failures);
  }

  async function runOperation(applyRule = false, rule = null, normalizedItem = null) {
    if (operationInFlightRef.current) return;

    operationInFlightRef.current = true;
    setSaving(true);
    setError('');
    setPendingRule(null);
    setPendingNormalization(null);
    let shouldCloseAfterSave = false;

    try {
      validateCommon();
      let operationSummary = null;

      if (operationType === 'movement') {
        operationSummary = await createMovement(applyRule, rule);
      }

      if (operationType === 'reproductive') {
        if (!formData.estadoResultanteId && !formData.tipoEvento) {
          throw new Error('Selecciona un estado o evento reproductivo.');
        }
        operationSummary = await createReproductiveEvents(applyRule, rule);
      }

      if (operationType === 'health') {
        if (formData.healthType === 'vaccination' && !formData.vacunaId && !formData.vacunaTexto) {
          throw new Error('Indica la vacuna.');
        }
        if (formData.healthType === 'deworming' && !formData.desparasitanteId && !formData.desparasitanteTexto) {
          throw new Error('Indica el producto de desparasitación.');
        }
        if (formData.healthType === 'disease' && !formData.enfermedadId && !formData.enfermedadTexto) {
          throw new Error('Indica la enfermedad.');
        }
        operationSummary = await createHealthRecords(normalizedItem);
      }

      await loadCatalogs?.();

      if (operationSummary?.successCount > 0 && operationSummary.failedCount === 0) {
        shouldCloseAfterSave = true;
        closeOperationAfterSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      operationInFlightRef.current = false;
      setSaving(false);
      if (!shouldCloseAfterSave) {
        focusReader();
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      validateCommon();
      const shouldContinue = await prepareHealthNormalization();
      if (!shouldContinue) return;
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
    window.sessionStorage.removeItem(draftStorageKey(operationType));
    focusReader();
  }

  function confirmNavigation() {
    window.sessionStorage.removeItem(draftStorageKey(operationType));
    pendingNavigation?.proceed?.();
    setPendingNavigation(null);
  }

  function cancelNavigation() {
    setPendingNavigation(null);
    focusReader();
  }

  async function acceptNormalizationSuggestion() {
    if (!pendingNormalization?.item) return;
    await runOperation(false, null, pendingNormalization.item);
  }

  async function saveManualNormalization() {
    setSaving(true);
    setError('');
    try {
      const created = await requestHealthNormalization({ createIfMissing: true });
      await runOperation(false, null, created?.item || null);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loadingCatalogs || loadingData) {
    return <p>Cargando flujo de trabajo...</p>;
  }

  if (catalogsError) {
    return <p className="alert error">Error cargando catálogos: {catalogsError}</p>;
  }

  return (
    <section className="page batch-operation-page">
      {flashKey > 0 && <span key={flashKey} className="watchlist-screen-flash reader-green-flash" aria-hidden="true" />}

      <form className="batch-operation-card" onSubmit={handleSubmit}>
        <div className="batch-operation-intro">
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </div>

        <input
          ref={readerInputRef}
          className="batch-reader-input"
          data-reader-capture="true"
          aria-label="Lector activo"
          inputMode="none"
          autoComplete="off"
          onFocus={() => setReaderActivationFallback(false)}
          onBlur={focusReader}
          onInput={handleReaderInput}
          onKeyDown={(event) => {
            if (silentReaderActiveRef.current) return;
            handleReaderKeyDown(event);
          }}
          onPaste={(event) => {
            if (silentReaderActiveRef.current) return;
            event.preventDefault();
            addCodes(extractCodes(event.clipboardData?.getData('text')));
          }}
        />

        <div className="batch-reader-status">
          <span className="batch-reader-dot" aria-hidden="true" />
          <strong>Lector activo</strong>
          <p>{readerMessage}</p>
          {readerActivationFallback && (
            <button
              type="button"
              className="batch-reader-activate"
              onClick={focusReader}
            >
              Activar lector
            </button>
          )}
        </div>

        {aiDraftTargetText && (
          <p className="batch-ai-hint">Preparado por IA: {aiDraftTargetText}</p>
        )}

        {aiSpeciesMismatchCount > 0 && (
          <p className="batch-ai-warning">
            Hay {aiSpeciesMismatchCount} animal{aiSpeciesMismatchCount === 1 ? '' : 'es'} que no coincide{aiSpeciesMismatchCount === 1 ? '' : 'n'} con la especie esperada. Puedes continuar si es correcto.
          </p>
        )}

        <div className="form-grid batch-operation-form-grid">
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
                  data-reader-manual="true"
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
                      data-reader-manual="true"
                      type="number"
                      min="0"
                      step="1"
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
              <label className="batch-checkbox batch-full-row">
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
                <label className="batch-full-row">
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

              {formData.healthType === 'vaccination' && (
                <>
                  <label>
                    Vacuna
                    <select
                      name="vacunaId"
                      value={formData.vacunaId}
                      onChange={handleChange}
                      onBlur={focusReader}
                      required
                    >
                      <option value="">Selecciona vacuna</option>
                      {vaccineOptions.map((vaccine) => (
                        <option key={vaccine.id} value={vaccine.id}>
                          {itemName(vaccine)}
                        </option>
                      ))}
                      <option value={OTHER_VALUE}>Otra</option>
                    </select>
                  </label>
                  {formData.vacunaId === OTHER_VALUE && (
                    <label>
                      Nombre de vacuna
                      <input
                        data-reader-manual="true"
                        name="vacunaTexto"
                        value={formData.vacunaTexto}
                        onChange={handleChange}
                        onBlur={focusReader}
                        placeholder="Ej. basquilla, lengua azul..."
                        required
                      />
                    </label>
                  )}
                  <label>
                    Lote
                    <input
                      data-reader-manual="true"
                      name="loteVacuna"
                      value={formData.loteVacuna}
                      onChange={handleChange}
                      onBlur={focusReader}
                      placeholder="Opcional"
                    />
                  </label>
                </>
              )}

              {formData.healthType === 'deworming' && (
                <>
                  <label>
                    Producto
                    <select
                      name="desparasitanteId"
                      value={formData.desparasitanteId}
                      onChange={handleChange}
                      onBlur={focusReader}
                      required
                    >
                      <option value="">Selecciona producto</option>
                      {dewormerOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {itemName(item)}
                        </option>
                      ))}
                      <option value={OTHER_VALUE}>Otro</option>
                    </select>
                  </label>
                  {formData.desparasitanteId === OTHER_VALUE && (
                    <label>
                      Nombre del producto
                      <input
                        data-reader-manual="true"
                        name="desparasitanteTexto"
                        value={formData.desparasitanteTexto}
                        onChange={handleChange}
                        onBlur={focusReader}
                        placeholder="Ej. ivermectina..."
                        required
                      />
                    </label>
                  )}
                  <label>
                    Tipo
                    <select
                      name="desparasitacionTipo"
                      value={formData.desparasitacionTipo}
                      onChange={handleChange}
                      onBlur={focusReader}
                    >
                      {Object.entries(DEWORMING_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
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
                      required
                    >
                      <option value="">Selecciona enfermedad</option>
                      {diseaseOptions.map((disease) => (
                        <option key={disease.id} value={disease.id}>
                          {itemName(disease)}
                        </option>
                      ))}
                      <option value={OTHER_VALUE}>Otra</option>
                    </select>
                  </label>
                  {formData.enfermedadId === OTHER_VALUE && (
                    <label>
                      Nombre de enfermedad
                      <input
                        data-reader-manual="true"
                        name="enfermedadTexto"
                        value={formData.enfermedadTexto}
                        onChange={handleChange}
                        onBlur={focusReader}
                        placeholder="Ej. cojeras, mamitis..."
                        required
                      />
                    </label>
                  )}
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

              {formData.healthType === 'other' && (
                <label className="batch-full-row">
                  Motivo del evento
                  <input
                    data-reader-manual="true"
                    name="otroSanitarioTexto"
                    value={formData.otroSanitarioTexto}
                    onChange={handleChange}
                    onBlur={focusReader}
                    placeholder="Ej. revisar ubre, herida, aborto..."
                    required
                  />
                </label>
              )}

              {['vaccination', 'deworming'].includes(formData.healthType) && (
                <>
                  <label>
                    Dosis
                    <input
                      data-reader-manual="true"
                      type="number"
                      min="0"
                      step="0.01"
                      name="dosisTexto"
                      value={formData.dosisTexto}
                      onChange={handleChange}
                      onBlur={focusReader}
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    Vía
                    <select
                      name="via"
                      value={formData.via}
                      onChange={handleChange}
                      onBlur={focusReader}
                    >
                      <option value="">Sin indicar</option>
                      {VIA_OPTIONS.map((via) => (
                        <option key={via} value={via}>
                          {via}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {['disease', 'other'].includes(formData.healthType) && (
                <label className="batch-full-row">
                  Signos o notas
                  <textarea
                    data-reader-manual="true"
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

      <AppModal
        open={Boolean(pendingNormalization)}
        title="Revisar nombre"
        description={pendingNormalization ? `Has escrito "${pendingNormalization.text}". ¿Querías decir "${pendingNormalization.item?.nombre}"?` : ''}
        onClose={() => setPendingNormalization(null)}
      >
        <div className="app-modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={saveManualNormalization}
          >
            Guardar como nuevo
          </button>
          <button type="button" disabled={saving} onClick={acceptNormalizationSuggestion}>
            Sí, usar sugerencia
          </button>
        </div>
      </AppModal>

      <AppModal
        open={Boolean(pendingNavigation)}
        title="Lista sin finalizar"
        description="Vas a perder la lista de crotales de esta operación. ¿Seguro que quieres salir?"
        onClose={cancelNavigation}
      >
        <div className="app-modal-footer">
          <button type="button" className="secondary" onClick={cancelNavigation}>
            Seguir aquí
          </button>
          <button type="button" onClick={confirmNavigation}>
            Salir
          </button>
        </div>
      </AppModal>
    </section>
  );
}
