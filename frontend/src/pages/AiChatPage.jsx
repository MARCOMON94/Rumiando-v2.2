import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../api/apiClient';

const QUICK_PROMPTS = [
  'Cuantos animales tengo por especie',
  'Tengo una oveja en el suelo que no se levanta',
  'Prepara un cambio de corral'
];

const AI_DRAFT_STORAGE_PREFIX = 'rumiando-ai-draft:';
const SILENT_READER_EVENT = 'rumiando:silent-reader:activate';

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
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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

  return /\b(mover|mueve|muevo|trasladar|traslada|pasar|pasa|meter|mete|apartar|aparta|cambiar|cambia)\b/.test(normalized)
    && /\b(oveja|ovejas|cabra|cabras|animal|animales|ganado|corral|lote|sitio)\b/.test(normalized);
}

function fallbackUiActionFromMessage(message, recentMessages = []) {
  const recentText = recentMessages
    .filter((item) => item.role === 'user')
    .map((item) => item.content)
    .join('\n');
  const normalized = normalizeText(`${recentText}\n${message}`);
  const current = normalizeText(message);
  const crotales = String(message || '').match(/\b(?:es[-_]?)?[a-z]{0,12}\d[a-z0-9_/-]{2,}\b/gi) || [];

  if (/\b(se ha muerto|se murio|ha muerto|esta muerto|esta muerta|muerto|muerta|fallecio|fallecido|fallecida)\b/.test(current)) {
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

  if (/\b(ha parido|pario|parto|ha tenido cria|ha tenido crias|nacimiento)\b/.test(current)) {
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
        crotales
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
  const endRef = useRef(null);

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

    if (uiAction.kind === 'operation_flow') {
      const route = uiAction.route || `/operations/${uiAction.operationType || 'movement'}`;
      const draftId = storeAiDraft(uiAction);
      navigate(`${route}?aiDraft=${encodeURIComponent(draftId)}`, {
        state: { fromAiChat: true }
      });
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
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  async function sendMessage(event) {
    event.preventDefault();

    const trimmed = input.trim();
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

      setConversationId(data.conversation_id);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          toolCalls: data.tool_calls || [],
          requiresConfirmation: data.requires_confirmation
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
            <button type="submit" disabled={loading || !input.trim()}>
              Enviar
            </button>
          </form>
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
    </section>
  );
}
