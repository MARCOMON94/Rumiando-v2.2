import { useEffect, useRef, useState } from 'react';
import { post } from '../api/apiClient';

const QUICK_PROMPTS = [
  'Cuantos animales tengo por especie',
  'Tengo una oveja en el suelo que no se levanta',
  'Prepara un cambio de corral'
];


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
