import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl, get, post } from '../api/apiClient';
import AppModal from '../components/ui/AppModal';

const QUICK_PROMPTS = [
  'Cuantos animales tengo por especie',
  'Tengo una oveja en el suelo que no se levanta',
  'Prepara un cambio de corral'
];

const AI_DRAFT_STORAGE_PREFIX = 'rumiando-ai-draft:';
const SILENT_READER_EVENT = 'rumiando:silent-reader:activate';
const VOICE_MAX_RECORDING_MS = 15000;
const VOICE_TRANSCRIPTION_TIMEOUT_MS = 30000;

function ChatMessage({ message }) {
  const isAssistant = message.role === 'assistant';
  const content = formatChatText(message.content);

  return (
    <article className={`chat-message ${isAssistant ? 'assistant' : 'user'}`}>
      <div className="chat-message-header">
        <span>{isAssistant ? 'RumiAndo IA' : 'Tu'}</span>
        {message.requiresConfirmation && <strong>Requiere confirmacion</strong>}
      </div>

      <p>
        {content.split('\n').map((line, index) => (
          <span key={`${line}-${index}`}>
            {index > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
    </article>
  );
}

function formatChatText(value) {
  return String(value || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function uiActionFromToolCalls(toolCalls = []) {
  return toolCalls
    .map((tool) => tool?.data?.ui_action || tool?.data?.uiAction)
    .find(Boolean) || null;
}

function normalizeText(value) {
  let text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  [
    ['bacun', 'vacun'],
    ['vacnu', 'vacun'],
    ['vacn', 'vacun'],
    ['vacunacin', 'vacunacion'],
    ['desparacit', 'desparasit'],
    ['inseminao', 'inseminado'],
    ['a parido', 'ha parido'],
    ['ha pario', 'ha parido']
  ].forEach(([before, after]) => {
    text = text.replaceAll(before, after);
  });

  return text;
}

const MOVEMENT_DESTINATIONS = [
  ['secado', 'secado'],
  ['secas', 'secado'],
  ['seca', 'secado'],
  ['produccion', 'produccion'],
  ['productoras', 'produccion'],
  ['lactacion', 'produccion'],
  ['lactancia', 'produccion'],
  ['paridera', 'paridas'],
  ['paridas', 'paridas'],
  ['gestantes', 'gestantes'],
  ['gestante', 'gestantes'],
  ['prenadas', 'gestantes'],
  ['cebo', 'cebo'],
  ['reposicion', 'reposicion'],
  ['recria', 'reposicion'],
  ['lazareto', 'lazareto'],
  ['enfermeria', 'lazareto']
];

function expectedSpeciesFromText(normalized) {
  if (/\b(cabra|cabras|caprino|caprinas)\b/.test(normalized)) return 'cabras';
  if (/\b(oveja|ovejas|ovino|ovinas)\b/.test(normalized)) return 'ovejas';
  if (/\b(cordero|corderos)\b/.test(normalized)) return 'corderos';
  if (/\b(cabrito|cabritos)\b/.test(normalized)) return 'cabritos';
  if (/\b(vaca|vacas|vacuno)\b/.test(normalized)) return 'vacas';
  return null;
}

function expectedCountFromText(normalized) {
  const numberMatch = normalized.match(/\b(\d{1,3})\s+(?:animales?|cabras?|ovejas?|corderos?|cabritos?|vacas?)\b/);
  if (numberMatch) return Number(numberMatch[1]);

  const words = {
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10
  };

  for (const [word, value] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\s+(?:animales?|cabras?|ovejas?|corderos?|cabritos?|vacas?)\\b`).test(normalized)) {
      return value;
    }
  }

  return null;
}

function movementDestinationFromText(normalized) {
  const placeTerms = MOVEMENT_DESTINATIONS.map(([term]) => term).join('|');
  const fromToMatch = normalized.match(new RegExp(`\\b(?:de|desde)\\s+(?:el\\s+)?(?:corral\\s+|lote\\s+)?(?:${placeTerms})\\s+(?:a|al|hacia|para)\\s+(?:el\\s+)?(?:corral\\s+|lote\\s+)?(${placeTerms})\\b`));
  const directMatch = normalized.match(new RegExp(`\\b(?:a|al|hacia|para)\\s+(?:el\\s+)?(?:corral\\s+|lote\\s+)?(${placeTerms})\\b`));
  const found = fromToMatch?.[1] || directMatch?.[1];

  if (found) {
    return MOVEMENT_DESTINATIONS.find(([term]) => term === found)?.[1] || found;
  }

  return MOVEMENT_DESTINATIONS.find(([term]) => new RegExp(`\\b${term}\\b`).test(normalized))?.[1] || null;
}

function looksLikeMovement(normalized) {
  const placeTerms = MOVEMENT_DESTINATIONS.map(([term]) => term).join('|');
  if (new RegExp(`\\b(?:de|desde)\\s+(?:el\\s+)?(?:corral\\s+|lote\\s+)?(?:${placeTerms})\\s+(?:a|al|hacia|para)\\s+(?:el\\s+)?(?:corral\\s+|lote\\s+)?(?:${placeTerms})\\b`).test(normalized)) {
    return true;
  }

  return /\b(mover|mueve|muevo|trasladar|traslada|pasar|pasa|meter|mete|apartar|aparta|cambiar|cambia|cambias|cambiamos)\b/.test(normalized)
    && /\b(oveja|ovejas|cabra|cabras|animal|animales|ganado|corral|lote|sitio)\b/.test(normalized);
}

function reproductiveDraftFromText(normalized) {
  const draft = {
    operationType: 'reproductive',
    expectedCount: expectedCountFromText(normalized),
    expectedSpecies: expectedSpeciesFromText(normalized)
  };
  const weeks = normalized.match(/\b(\d{1,2})\s*(?:semanas?|sem)\b/)?.[1];

  if (weeks) draft.semanasGestacion = weeks;

  if (/\b(inseminacion|inseminar|inseminado|inseminada|insemine)\b/.test(normalized)) {
    draft.tipoEvento = 'INSEMINACION';
  } else if (/\b(cubricion|cubrir|cubri|cubierto|echar macho)\b/.test(normalized)) {
    draft.tipoEvento = 'CUBRICION';
  } else if (/\b(gestante|gestantes|prenada|prenadas|diagnostico|ecografia|eco)\b/.test(normalized)) {
    draft.tipoEvento = 'DIAGNOSTICO_GESTACION';
    draft.resultado = 'POSITIVO';
    draft.estadoResultanteAlias = 'gestante';
  } else if (/\b(secado|seca|secar)\b/.test(normalized)) {
    draft.tipoEvento = 'SECADO';
    draft.estadoResultanteAlias = 'seca';
  }

  return draft;
}

function fallbackUiActionFromMessage(message, recentMessages = []) {
  const recentText = recentMessages
    .filter((item) => item.role === 'user')
    .map((item) => item.content)
    .join('\n');
  const normalized = normalizeText(`${recentText}\n${message}`);
  const current = normalizeText(message);
  const crotales = String(message || '').match(/\b(?:es[-_]?)?[a-z]{0,12}\d[a-z0-9_/-]{2,}\b/gi) || [];

  if (/\b(se ha muerto|se murio|murio|ha muerto|esta muerto|esta muerta|muerto|muerta|muerte|dar de baja|baja animal|fallecio|fallecido|fallecida)\b/.test(current)) {
    return {
      kind: 'silent_reader',
      action: 'baja',
      route: '/animals/:id/discharge',
      crotales,
      draft: {
        motivo: 'muerte',
        fecha: 'hoy',
        observaciones: 'muerte indicada por el usuario'
      }
    };
  }

  if (/\b(acaba de parir|acabo de parir|ha parido|pario|parir|parido|recien parida|parto|ha tenido cria|ha tenido crias|nacimiento|nacer|nacio|nacieron|nacido|nacidos|nacida|nacidas|acaba de nacer|acaban de nacer)\b/.test(current)) {
    return {
      kind: 'silent_reader',
      action: 'parto',
      route: '/birth/new/:motherId',
      crotales,
      draft: {
        expectedSpecies: expectedSpeciesFromText(normalized)
      }
    };
  }

  if (/\b(excel|xlsx|exportar|exporta|descargar)\b/.test(current) && /\b(baja|bajas|muertes|salidas)\b/.test(current)) {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return {
      kind: 'analytics_export',
      fallbackRoute: '/dashboard',
      query: {
        dataset: 'discharges',
        view: 'list',
        groupBy: 'period',
        filters: {
          fechaDesde: current.includes('ultimo mes') || current.includes('ultimos 30 dias') ? from.toISOString().slice(0, 10) : '',
          fechaHasta: current.includes('ultimo mes') || current.includes('ultimos 30 dias') ? today.toISOString().slice(0, 10) : ''
        }
      }
    };
  }

  if (looksLikeMovement(current) || looksLikeMovement(normalized)) {
    const targetPenName = movementDestinationFromText(current) || movementDestinationFromText(normalized);
    return {
      kind: 'operation_flow',
      operationType: 'movement',
      route: '/operations/movement',
      draft: {
        operationType: 'movement',
        targetPenName,
        corralDestinoAlias: targetPenName,
        expectedCount: expectedCountFromText(normalized),
        expectedSpecies: expectedSpeciesFromText(normalized),
        crotales,
        motivo: 'Preparado desde el chat IA'
      }
    };
  }

  if (/\b(vacuna|vacunar|vacune|vacunacion)\b/.test(current)) {
    return {
      kind: 'operation_flow',
      operationType: 'health',
      route: '/operations/health',
      draft: {
        operationType: 'health',
        healthType: 'vaccination',
        expectedCount: expectedCountFromText(normalized),
        expectedSpecies: expectedSpeciesFromText(normalized),
        crotales,
        fullPen: /\b(corral completo|todo el corral|todo un corral|todo corral|por corral)\b/.test(current)
      }
    };
  }

  if (/\b(desparasita|desparasitar|desparasitado|antiparasitario)\b/.test(current)) {
    return {
      kind: 'operation_flow',
      operationType: 'health',
      route: '/operations/health',
      draft: {
        operationType: 'health',
        healthType: 'deworming',
        expectedCount: expectedCountFromText(normalized),
        expectedSpecies: expectedSpeciesFromText(normalized),
        crotales,
        fullPen: /\b(corral completo|todo el corral|todo un corral|todo corral|por corral)\b/.test(current)
      }
    };
  }

  if (/\b(inseminacion|inseminar|inseminado|insemine|cubricion|cubrir|cubri|echar macho|gestante|gestantes|prenada|prenadas|secado|seca|secar)\b/.test(current)) {
    return {
      kind: 'operation_flow',
      operationType: 'reproductive',
      route: '/operations/reproductive',
      draft: {
        ...reproductiveDraftFromText(current),
        crotales
      }
    };
  }

  return null;
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  for (const key of ['data', 'animals', 'animales']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

function normalizeCode(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

function extractCodes(raw) {
  return String(raw || '')
    .split(/[\s,;]+/)
    .map(normalizeCode)
    .filter(Boolean);
}

function isLikelyReaderCode(value) {
  const code = normalizeCode(value);
  return Boolean(code && code.length >= 3 && /\d/.test(code));
}

function extractReaderCodes(raw) {
  return extractCodes(raw).filter(isLikelyReaderCode);
}

function isReaderInteractiveElement(element) {
  return Boolean(element?.closest?.(
    'input, textarea, select, button, a[href], [contenteditable="true"], [role="button"]'
  ));
}

function routeForSilentAction(action, animalId) {
  if (action === 'parto') return `/birth/new/${animalId}`;
  if (action === 'baja') return `/animals/${animalId}/discharge`;
  return `/animals/${animalId}?preview=1`;
}

function dischargeReason(reason) {
  const normalized = String(reason || '').toLowerCase();
  if (normalized.includes('venta') || normalized.includes('traslado')) return 'Venta / traslado';
  if (normalized.includes('sacrificio')) return 'Sacrificio';
  if (normalized.includes('desapare')) return 'Desaparecido';
  if (normalized.includes('otro')) return 'Otro';
  return 'Muerte';
}

function storeAiDraft(uiAction) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(`${AI_DRAFT_STORAGE_PREFIX}${id}`, JSON.stringify({
    ...(uiAction.draft || {}),
    source: 'ai_chat',
    createdAt: new Date().toISOString()
  }));
  return id;
}

function aiOperationTitle(operationType) {
  if (operationType === 'health') return 'Evento sanitario';
  if (operationType === 'reproductive') return 'Estado reproductivo';
  return 'Movimiento de corral';
}

function uiActionOpenedMessage(uiAction) {
  if (uiAction?.kind === 'operation_flow') {
    return 'He abierto el flujo para pasar crotales, revisar la lista y pulsar Finalizar.';
  }

  if (uiAction?.kind === 'silent_reader') {
    if (uiAction.action === 'parto') return 'He activado el lector para localizar la madre y abrir el parto.';
    if (uiAction.action === 'baja') return 'He activado el lector para localizar el animal y abrir la baja.';
    return 'He activado el lector para abrir la ficha del animal.';
  }

  if (uiAction?.kind === 'manual_reminder') {
    return 'He abierto la pantalla para preparar la alerta manual.';
  }

  return null;
}

function filenameFromDisposition(disposition) {
  const match = String(disposition || '').match(/filename="?([^";]+)"?/i);
  return match?.[1] || `rumiando_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function blurActiveElement() {
  const activeElement = document.activeElement;
  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }
  window.getSelection?.()?.removeAllRanges?.();
}

function speechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}


function preferredAudioMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus'
  ];

  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}


function audioFilenameForBlob(blob) {
  const type = String(blob?.type || '').toLowerCase();
  if (type.includes('mp4')) return 'rumiando-voice.m4a';
  if (type.includes('ogg')) return 'rumiando-voice.ogg';
  if (type.includes('wav')) return 'rumiando-voice.wav';
  return 'rumiando-voice.webm';
}


export default function AiChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Cuentame que esta pasando o que dato necesitas y te ayudo con el siguiente paso.'
    }
  ]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeOperationAction, setActiveOperationAction] = useState(null);
  const [voiceState, setVoiceState] = useState('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const endRef = useRef(null);
  const operationFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const voiceFinalRef = useRef('');
  const voiceInterimRef = useRef('');
  const voiceSendOnEndRef = useRef(false);
  const voiceStopTimerRef = useRef(null);
  const operationReaderBufferRef = useRef('');
  const operationReaderTimerRef = useRef(null);

  async function findAnimalByCode(code) {
    const normalized = normalizeCode(code);
    if (!normalized) return null;

    const data = await get(`/animals?search=${encodeURIComponent(normalized)}`);
    return getItems(data).find((animal) => (
      [animal?.crotal, animal?.numeroInterno]
        .filter(Boolean)
        .some((value) => normalizeCode(value) === normalized)
    )) || getItems(data)[0] || null;
  }

  async function handleUiAction(uiAction) {
    if (!uiAction?.kind) return;

    if (uiAction.kind === 'analytics_export') {
      try {
        const response = await fetch(`${apiUrl()}/analytics/export/excel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(uiAction.query || {})
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || 'No se pudo generar el Excel');
        }

        const blob = await response.blob();
        downloadBlob(blob, filenameFromDisposition(response.headers.get('content-disposition')));
      } catch (err) {
        setError(err.message || 'No se pudo generar el Excel');
        navigate(uiAction.fallbackRoute || '/dashboard', {
          state: {
            aiDraft: uiAction.query || null,
            fromAiChat: true
          }
        });
      }
      return;
    }

    if (uiAction.kind === 'operation_flow') {
      blurActiveElement();
      const route = uiAction.route || `/operations/${uiAction.operationType || 'movement'}`;
      const draftId = storeAiDraft(uiAction);
      const embeddedRoute = route.replace(/^\/operations\//, '/ai-chat/operation/');
      setActiveOperationAction({
        draftId,
        title: aiOperationTitle(uiAction.operationType),
        src: `${embeddedRoute}?aiDraft=${encodeURIComponent(draftId)}&embedded=1`
      });
      window.setTimeout(blurActiveElement, 50);
      return;
    }

    if (uiAction.kind === 'open_route') {
      navigate(uiAction.route || '/');
      return;
    }

    if (uiAction.kind === 'manual_reminder') {
      navigate(uiAction.route || '/reminders', {
        state: { aiDraft: uiAction.draft || null, fromAiChat: true }
      });
      return;
    }

    if (uiAction.kind === 'silent_reader') {
      const action = uiAction.action || 'lookup';
      const firstCode = (uiAction.crotales || [])[0];
      const state = {
        openedBySilentReader: true,
        returnTo: '/ai-chat',
        returnMode: 'back',
        silentAction: action,
        fromAiChat: true,
        aiDraft: uiAction.draft || null
      };

      if (action === 'baja') {
        state.motivo = dischargeReason(uiAction.draft?.motivo);
      }

      if (firstCode) {
        try {
          const animal = await findAnimalByCode(firstCode);
          if (animal?.id) {
            navigate(routeForSilentAction(action, animal.id), { state });
            return;
          }
        } catch {
          // Si la busqueda directa falla, dejamos el lector preparado igualmente.
        }
      }

      window.dispatchEvent(new CustomEvent(SILENT_READER_EVENT, {
        detail: {
          action,
          state
        }
      }));
    }
  }

  useEffect(() => {
    if (voiceState === 'listening' || voiceState === 'processing') return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, voiceState]);

  useEffect(() => {
    function handleOperationMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'rumiando:ai-operation-complete') return;

      setActiveOperationAction((current) => {
        if (current?.draftId) {
          window.sessionStorage.removeItem(`${AI_DRAFT_STORAGE_PREFIX}${current.draftId}`);
        }
        return null;
      });
    }

    window.addEventListener('message', handleOperationMessage);

    return () => {
      window.removeEventListener('message', handleOperationMessage);
    };
  }, []);

  useEffect(() => {
    if (!activeOperationAction) return undefined;

    function postCodesToOperation(raw) {
      const codes = extractReaderCodes(raw);
      if (!codes.length) return;

      operationFrameRef.current?.contentWindow?.postMessage({
        type: 'rumiando:operation-reader-codes',
        codes
      }, window.location.origin);
    }

    function resetBuffer() {
      operationReaderBufferRef.current = '';
      window.clearTimeout(operationReaderTimerRef.current);
    }

    function flushBuffer() {
      const raw = operationReaderBufferRef.current;
      resetBuffer();
      postCodesToOperation(raw);
    }

    function stopReaderEvent(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function handleCaptureKeyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isReaderInteractiveElement(event.target)) return;

      const isFinishKey = event.key === 'Enter' || event.key === 'Tab';
      const isCharacter = event.key.length === 1;
      const isBackspace = event.key === 'Backspace';

      if (!isFinishKey && !isCharacter && !isBackspace) return;

      if (isFinishKey && !operationReaderBufferRef.current) return;

      stopReaderEvent(event);

      if (isFinishKey) {
        flushBuffer();
        return;
      }

      if (isBackspace) {
        operationReaderBufferRef.current = operationReaderBufferRef.current.slice(0, -1);
        return;
      }

      operationReaderBufferRef.current += event.key;
      window.clearTimeout(operationReaderTimerRef.current);
      operationReaderTimerRef.current = window.setTimeout(flushBuffer, 160);
    }

    function handleCapturePaste(event) {
      const pasted = event.clipboardData?.getData('text');
      if (!pasted) return;
      if (isReaderInteractiveElement(event.target)) return;
      if (!extractReaderCodes(pasted).length) return;

      stopReaderEvent(event);
      resetBuffer();
      postCodesToOperation(pasted);
    }

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    window.addEventListener('paste', handleCapturePaste, true);

    return () => {
      window.removeEventListener('keydown', handleCaptureKeyDown, true);
      window.removeEventListener('paste', handleCapturePaste, true);
      resetBuffer();
    };
  }, [activeOperationAction]);

  function closeOperationOverlay() {
    blurActiveElement();
    setActiveOperationAction((current) => {
      if (current?.draftId) {
        window.sessionStorage.removeItem(`${AI_DRAFT_STORAGE_PREFIX}${current.draftId}`);
      }
      return null;
    });
  }

  async function sendChatText(rawText) {
    const trimmed = String(rawText || '').trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const recentMessages = [...messages, userMessage]
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .filter((message) => !message.uiActionOpened)
        .slice(-20)
        .map((message) => ({
          role: message.role,
          content: message.content
        }));

      const data = await post('/ai/chat', {
        message: trimmed,
        conversation_id: conversationId,
        context: {
          recent_messages: recentMessages
        }
      });

      const uiAction = uiActionFromToolCalls(data.tool_calls || [])
        || fallbackUiActionFromMessage(trimmed, recentMessages);
      if (uiAction) await handleUiAction(uiAction);

      const openedMessage = uiActionOpenedMessage(uiAction);

      setConversationId(data.conversation_id);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: openedMessage || data.answer,
          sources: data.sources || [],
          toolCalls: data.tool_calls || [],
          requiresConfirmation: openedMessage ? false : data.requires_confirmation,
          uiActionOpened: Boolean(openedMessage)
        }
      ]);
    } catch (err) {
      setError(err.message);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'No he podido conectar con el servicio IA en este momento.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    await sendChatText(input);
  }

  function stopMediaStream() {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function clearVoiceStopTimer() {
    window.clearTimeout(voiceStopTimerRef.current);
    voiceStopTimerRef.current = null;
  }

  function stopMediaRecorderWithoutSend(updateState = true) {
    clearVoiceStopTimer();
    voiceSendOnEndRef.current = false;
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        stopMediaStream();
      }
    } else {
      stopMediaStream();
    }

    if (updateState) {
      setVoiceState('idle');
    }
  }

  function stopRecognitionWithoutSend(updateState = true) {
    clearVoiceStopTimer();
    voiceSendOnEndRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // El navegador puede cerrar el reconocimiento por su cuenta.
      }
    }
    if (updateState) {
      setVoiceState('idle');
    }
  }

  function startSpeechRecognitionFallback() {
    const Recognition = speechRecognitionClass();
    if (!Recognition) {
      setVoiceError('La grabación de voz no está disponible en este navegador.');
      return;
    }

    voiceFinalRef.current = '';
    voiceInterimRef.current = '';
    voiceSendOnEndRef.current = false;

    const recognition = new Recognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (resultEvent) => {
      let interim = '';
      let final = voiceFinalRef.current;

      for (let index = resultEvent.resultIndex; index < resultEvent.results.length; index += 1) {
        const transcript = resultEvent.results[index]?.[0]?.transcript || '';
        if (resultEvent.results[index]?.isFinal) {
          final = `${final} ${transcript}`.trim();
        } else {
          interim = `${interim} ${transcript}`.trim();
        }
      }

      voiceFinalRef.current = final;
      voiceInterimRef.current = interim;
      setVoiceTranscript([final, interim].filter(Boolean).join(' '));
    };

    recognition.onerror = (errorEvent) => {
      if (errorEvent.error === 'aborted') return;
      voiceSendOnEndRef.current = false;
      setVoiceState('idle');
      setVoiceTranscript('');
      setVoiceError('No he podido escuchar bien. Pulsa otra vez y habla cerca del móvil.');
    };

    recognition.onend = () => {
      clearVoiceStopTimer();
      const text = [voiceFinalRef.current, voiceInterimRef.current].filter(Boolean).join(' ').trim();
      recognitionRef.current = null;

      if (!voiceSendOnEndRef.current) {
        setVoiceState('idle');
        return;
      }

      voiceSendOnEndRef.current = false;
      setVoiceTranscript('');

      if (!text) {
        setVoiceState('idle');
        setVoiceError('No he entendido nada. Pulsa otra vez y habla un poco más cerca.');
        return;
      }

      setVoiceState('processing');
      sendChatText(text).finally(() => {
        setVoiceState('idle');
      });
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceState('listening');
      setVoiceTranscript('Escuchando... pulsa de nuevo para terminar.');
      clearVoiceStopTimer();
      voiceStopTimerRef.current = window.setTimeout(() => {
        voiceSendOnEndRef.current = true;
        try {
          recognition.stop();
        } catch {
          stopRecognitionWithoutSend();
        }
      }, VOICE_MAX_RECORDING_MS);
    } catch {
      recognitionRef.current = null;
      setVoiceState('idle');
      setVoiceTranscript('');
      setVoiceError('No se pudo activar el micrófono.');
    }
  }

  function voiceErrorMessage(response, payload) {
    const rawMessage = typeof payload === 'string'
      ? payload
      : (payload?.error || payload?.message || payload?.detail || '');
    const normalized = `${response.status} ${rawMessage}`.toLowerCase();

    if (response.status === 404 || normalized.includes('not found')) {
      return 'La ruta de voz no existe en el backend desplegado. Revisa VITE_API_URL, _redirects y que Railway tenga POST /api/ai/transcribe.';
    }
    if (response.status === 502 || normalized.includes('ai_service_url') || normalized.includes('servicio de transcripcion')) {
      return 'No se pudo conectar con el servicio de transcripción local. Revisa AI_SERVICE_URL en Railway Backend.';
    }
    if (response.status === 503 && normalized.includes('whisper')) {
      return 'Whisper local no está instalado o no arrancó en el servicio IA. Redeploya ai-service con faster-whisper.';
    }
    if (response.status === 504 || normalized.includes('tiempo') || normalized.includes('timeout')) {
      return 'La transcripción tardó demasiado. Si es la primera vez, puede estar descargando el modelo Whisper; prueba otra vez en unos segundos.';
    }
    if (rawMessage) {
      return rawMessage;
    }
    return 'No se pudo transcribir el audio.';
  }

  async function transcribeAudio(blob) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), VOICE_TRANSCRIPTION_TIMEOUT_MS);

    try {
      const response = await fetch(`${apiUrl()}/ai/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
          'x-audio-filename': audioFilenameForBlob(blob),
          'x-audio-language': 'es'
        },
        credentials: 'include',
        signal: controller.signal,
        body: blob
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

      if (!response.ok) {
        throw new Error(voiceErrorMessage(response, payload));
      }

      const text = String(payload?.text || '').trim();
      if (!text) {
        throw new Error('No se entendió ningún texto en el audio.');
      }
      return text;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('La transcripción tardó demasiado. Prueba otra vez con un audio más corto.', { cause: err });
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function startVoiceInput(event) {
    event.preventDefault();
    if (loading || voiceState === 'listening' || voiceState === 'processing') return;

    blurActiveElement();
    setVoiceError('');
    setVoiceTranscript('');
    voiceSendOnEndRef.current = false;
    mediaChunksRef.current = [];

    if (speechRecognitionClass()) {
      startSpeechRecognitionFallback();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      startSpeechRecognitionFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];

      recorder.ondataavailable = (dataEvent) => {
        if (dataEvent.data?.size > 0) {
          mediaChunksRef.current.push(dataEvent.data);
        }
      };

      recorder.onerror = () => {
        clearVoiceStopTimer();
        voiceSendOnEndRef.current = false;
        mediaRecorderRef.current = null;
        stopMediaStream();
        setVoiceState('idle');
        setVoiceTranscript('');
        setVoiceError('No he podido grabar bien. Pulsa otra vez y prueba de nuevo.');
      };

      recorder.onstop = async () => {
        clearVoiceStopTimer();
        const shouldSend = voiceSendOnEndRef.current;
        const chunks = [...mediaChunksRef.current];
        const finalMimeType = recorder.mimeType || mimeType || 'audio/webm';

        voiceSendOnEndRef.current = false;
        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        stopMediaStream();

        if (!shouldSend) {
          setVoiceState('idle');
          return;
        }

        if (!chunks.length) {
          setVoiceState('idle');
          setVoiceTranscript('');
          setVoiceError('No se grabó audio. Pulsa para empezar, habla y vuelve a pulsar para terminar.');
          return;
        }

        const blob = new Blob(chunks, { type: finalMimeType });
        setVoiceState('processing');
        setVoiceTranscript('Transcribiendo audio...');

        try {
          const text = await transcribeAudio(blob);
          if (!text) {
            throw new Error('No se entendió ningún texto en el audio');
          }
          setVoiceTranscript('');
          await sendChatText(text);
        } catch (err) {
          setVoiceTranscript('');
          setVoiceError(err.message || 'No se pudo transcribir el audio.');
        } finally {
          setVoiceState('idle');
        }
      };

      recorder.start();
      setVoiceState('listening');
      setVoiceTranscript('Escuchando... pulsa de nuevo para terminar.');
      clearVoiceStopTimer();
      voiceStopTimerRef.current = window.setTimeout(() => {
        const activeRecorder = mediaRecorderRef.current;
        if (!activeRecorder || activeRecorder.state === 'inactive') return;
        voiceSendOnEndRef.current = true;
        try {
          activeRecorder.stop();
        } catch {
          stopMediaRecorderWithoutSend();
        }
      }, VOICE_MAX_RECORDING_MS);
    } catch {
      stopMediaStream();
      startSpeechRecognitionFallback();
    }
  }

  function finishVoiceInput(event) {
    event.preventDefault();
    clearVoiceStopTimer();
    if (voiceState !== 'listening') return;

    voiceSendOnEndRef.current = true;
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      try {
        recorder.stop();
      } catch {
        stopMediaRecorderWithoutSend();
      }
      return;
    }

    if (!recognitionRef.current) {
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      stopRecognitionWithoutSend();
    }
  }

  useEffect(() => {
    return () => {
      clearVoiceStopTimer();
      stopMediaRecorderWithoutSend(false);
      stopRecognitionWithoutSend(false);
    };
  }, []);

  function fillPrompt(prompt) {
    setInput(prompt);
  }

  function shouldSendWithEnter() {
    return !window.matchMedia?.('(pointer: coarse)').matches;
  }

  function handleComposerKeyDown(event) {
    if (
      event.key === 'Enter'
      && !event.shiftKey
      && !event.nativeEvent.isComposing
      && shouldSendWithEnter()
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section className="page ai-chat-page">
      <header className="page-header">
        <div>
          <h2>Asistente IA</h2>
        </div>
      </header>

      <div className="chat-layout">
        <section className="chat-panel">
          <div className="chat-messages" aria-live="polite">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {loading && (
              <article className="chat-message assistant">
                <div className="chat-message-header">
                  <span>RumiAndo IA</span>
                </div>
                <p>Procesando...</p>
              </article>
            )}

            <div ref={endRef} />
          </div>

          {error && <p className="alert error">Error: {error}</p>}
          {voiceError && <p className="alert error">{voiceError}</p>}

          <form className="chat-composer" onSubmit={sendMessage}>
            <label htmlFor="ai-message">Mensaje</label>
            <textarea
              id="ai-message"
              rows="4"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Pregunta por animales, sanidad, avisos, corrales o movimientos..."
            />
            <button
              type="button"
              className={`voice-hold-button ${voiceState === 'listening' ? 'recording' : ''}`}
              disabled={loading || voiceState === 'processing'}
              onClick={voiceState === 'listening' ? finishVoiceInput : startVoiceInput}
              onContextMenu={(event) => event.preventDefault()}
              aria-label={voiceState === 'listening' ? 'Terminar dictado de voz' : 'Empezar dictado de voz'}
            >
              <span aria-hidden="true" />
              {voiceState === 'listening' ? 'Pulsa para terminar' : 'Pulsa para hablar'}
            </button>
            <button type="submit" disabled={loading || !input.trim()}>
              Enviar
            </button>
          </form>

          {(voiceTranscript || voiceState === 'processing') && (
            <p className="voice-transcript">
              {voiceState === 'processing' ? (voiceTranscript || 'Enviando dictado...') : voiceTranscript}
            </p>
          )}
        </section>

        <aside className="chat-side-panel">
          <h3>Consultas rapidas</h3>
          <div className="quick-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="secondary"
                onClick={() => fillPrompt(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </aside>
      </div>

      <AppModal
        open={Boolean(activeOperationAction)}
        title={activeOperationAction?.title || 'Acción preparada'}
        description="Pasa crotales, revisa la lista y pulsa Finalizar."
        onClose={closeOperationOverlay}
        modalClassName="ai-action-modal"
      >
        {activeOperationAction && (
          <iframe
            ref={operationFrameRef}
            className="ai-action-frame"
            title={activeOperationAction.title}
            src={activeOperationAction.src}
            onLoad={() => {
              try {
                operationFrameRef.current?.contentWindow?.focus();
              } catch {
                // El navegador puede bloquear el foco del iframe; dentro queda el boton Activar lector.
              }
            }}
          />
        )}
      </AppModal>
    </section>
  );
}
