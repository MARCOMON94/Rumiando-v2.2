# RumiAndo AI Service

Servicio IA independiente para el MVP de RumiAndo.

## Arranque local

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Crear ai-service/.env con las variables necesarias
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Para activar LangGraph/ChromaDB en una iteracion posterior:

```bash
pip install -r requirements-rag.txt
```

## Endpoints

- `GET /api/health`
- `POST /api/chat`
- `GET /api/chat/history/{conversation_id}`
- `GET /api/learning/unresolved`
- `GET /api/learning/weekly-summary`

Los endpoints de `learning` requieren:

```txt
Authorization: Bearer LEARNING_QUEUE_TOKEN
```

## Variables relevantes

```env
CHAT_HISTORY_MODE=none
CHAT_HISTORY_TTL_MINUTES=60
MAX_HISTORY_MESSAGES=20

SAVE_UNRESOLVED_QUESTIONS=true
ANONYMIZE_UNRESOLVED_QUESTIONS=true
LEARNING_USE_OPENAI_REFORMULATION=false
LEARNING_QUEUE_TOKEN=""

USE_LLM=false
OPENAI_FALLBACK_ON_UNKNOWN=true
OPENAI_STORE=false
OPENAI_MAX_OUTPUT_TOKENS=350
```

Con estos valores, OpenAI solo se usa como ultimo recurso si la respuesta local
con RAG no es suficiente. El historial no se guarda en backend: la continuidad
vive en los mensajes recientes enviados por la pantalla abierta. La cola de
aprendizaje guarda casos redactados para mejorar la base RAG, no conversaciones
completas.

## RAG

El servicio lee documentos `.md` y `.txt` desde `ai-service/knowledge/`.
No se incluyen documentos de dominio inventados. La guia de generacion esta en
`docs/rag-documentos-necesarios.md`.

