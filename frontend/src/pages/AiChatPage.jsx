import { useEffect, useRef, useState } from 'react';
import { post } from '../api/apiClient';
import AnimalReaderPanel from '../components/reader/AnimalReaderPanel';

const QUICK_PROMPTS = [
  'Cuantos animales tengo por especie',
  'Tengo una oveja en el suelo que no se levanta',
  'Prepara un cambio de corral'
];

const READER_ACTION_TYPES = [
  'ANIMAL_DISCHARGE',
  'CHANGE_PEN',
  'CREATE_HEALTH_CASE',
  'CREATE_TREATMENT',
  'CREATE_VACCINATION',
  'CREATE_DEWORMING',
  'CREATE_REPRODUCTIVE_EVENT'
];

const ACTION_TITLES = {
  ANIMAL_DISCHARGE: 'Leer animal para baja',
  CHANGE_PEN: 'Leer animales para movimiento',
  CREATE_HEALTH_CASE: 'Leer animales para caso sanitario',
  CREATE_TREATMENT: 'Leer animales para tratamiento',
  CREATE_VACCINATION: 'Leer animales para vacunacion',
  CREATE_DEWORMING: 'Leer animales para desparasitacion',
  CREATE_REPRODUCTIVE_EVENT: 'Leer animal para reproduccion'
};


function ChatMessage({ message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <article className={`chat-message ${isAssistant ? 'assistant' : 'user'}`}>
      <div className="chat-message-header">
        <span>{isAssistant ? 'RumiAndo IA' : 'Tu'}</span>
        {message.requiresConfirmation && <strong>Requiere confirmacion</strong>}
      </div>

      <p>{message.content}</p>
    </article>
  );
}

function readerRequestFromToolCalls(toolCalls = []) {
  const tool = toolCalls.find((item) => {
    const actionType = item?.data?.action_type || item?.data?.actionType;
    return READER_ACTION_TYPES.includes(actionType);
  });

  if (!tool) {
    return null;
  }

  const actionType = tool.data?.action_type || tool.data?.actionType;
  return {
    actionType,
    toolName: tool.name,
    summary: tool.output_summary,
    draft: tool.data?.draft || null,
    preferredMode: tool.data?.draft?.preferred_mode || null,
    originalMessage: tool.data?.original_message || tool.data?.originalMessage || ''
  };
}

function summarizeReaderDraft(draft) {
  if (!draft) return 'Lectura finalizada.';
  const actionLabel = draft.actionKind ? ` para ${draft.actionKind.replaceAll('_', ' ')}` : '';
  if (draft.mode === 'corral') {
    return `Lectura finalizada${actionLabel}: ${draft.pens.length} corral(es) seleccionados. Queda como borrador pendiente.`;
  }
  return `Lectura finalizada${actionLabel}: ${draft.animals.length} animal(es) y ${draft.unknownCodes.length} lectura(s) no encontrada(s). Queda como borrador pendiente.`;
}

function initialModeForReader(request) {
  if (!request) return 'lote';
  if (request.preferredMode) return request.preferredMode;
  if (request.actionType === 'ANIMAL_DISCHARGE' || request.actionType === 'CREATE_REPRODUCTIVE_EVENT') {
    return 'unitario';
  }

  const text = `${request.originalMessage || ''} ${request.summary || ''}`.toLowerCase();
  if (text.includes('corral completo') || text.includes('todo el corral') || text.includes('por corral')) {
    return 'corral';
  }

  return 'lote';
}


export default function AiChatPage() {
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
  const [readerRequest, setReaderRequest] = useState(null);
  const endRef = useRef(null);

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

      const nextReaderRequest = readerRequestFromToolCalls(data.tool_calls || []);
      if (nextReaderRequest) {
        setReaderRequest(nextReaderRequest);
      }

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

  function handleReaderFinish(draft) {
    setMessages((current) => [
      ...current,
      {
        id: `reader-${Date.now()}`,
        role: 'assistant',
        content: summarizeReaderDraft(draft)
      }
    ]);
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
          {readerRequest && (
            <AnimalReaderPanel
              compact
              title={ACTION_TITLES[readerRequest.actionType] || 'Leer animales'}
              subtitle="Pasa el lector. Los crotales repetidos se ignoran."
              initialMode={initialModeForReader(readerRequest)}
              actionRequest={readerRequest}
              onFinish={handleReaderFinish}
            />
          )}

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
