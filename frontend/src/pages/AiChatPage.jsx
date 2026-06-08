import { useEffect, useRef, useState } from 'react';
import { post } from '../api/apiClient';

const QUICK_PROMPTS = [
  'Resume los avisos pendientes de hoy',
  'Busca el animal con crotal ES0001',
  'Que debo revisar antes de mover un lote de corral'
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

      {message.sources?.length > 0 && (
        <details className="chat-details">
          <summary>Fuentes</summary>
          <ul>
            {message.sources.map((source) => (
              <li key={source.source_id}>
                <strong>{source.title}</strong>
                <span>{source.file}</span>
                <p>{source.excerpt}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      {message.toolCalls?.length > 0 && (
        <details className="chat-details">
          <summary>Tools</summary>
          <ul>
            {message.toolCalls.map((tool, index) => (
              <li key={`${tool.name}-${index}`}>
                <strong>{tool.name}</strong>
                <span>{tool.status}</span>
                <p>{tool.output_summary}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}


export default function AiChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Listo para consultar documentos RAG y datos de la explotacion cuando esten disponibles.'
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
      const data = await post('/ai/chat', {
        message: trimmed,
        conversation_id: conversationId
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

  return (
    <section className="page ai-chat-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">MVP IA</p>
          <h2>Asistente IA</h2>
          <p>Chat con RAG, memoria y tools de consulta de datos.</p>
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
              placeholder="Pregunta por avisos, animales, sanidad o documentos..."
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Enviar
            </button>
          </form>
        </section>

        <aside className="chat-side-panel">
          <h3>Consultas rápidas</h3>
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

          <div className="chat-note">
            <strong>Alcance MVP</strong>
            <p>La IA prepara y orienta. Las acciones sobre datos se confirman en la app.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
