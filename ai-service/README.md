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

El flujo del chat usa LangGraph como orquestador cuando la dependencia esta
instalada. Si una maquina local no tiene LangGraph disponible, el servicio cae
al mismo flujo secuencial para no bloquear desarrollo.

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

## Orquestacion IA

El agente mantiene la logica de respuestas locales, RAG, tools de app,
fallback OpenAI y cola de aprendizaje, pero el recorrido se organiza en un
grafo:

1. `analyze`: contexto conversacional, triaje e intencion.
2. `retrieve`: busqueda RAG y tools de datos/acciones.
3. `prepare_context`: deduplicacion de fuentes y confirmaciones.
4. `compose_answer`: respuesta local o fallback si procede.
5. `queue_learning`: registro redactado de preguntas no cubiertas.

`GET /api/health` devuelve `agent.orchestrator` para comprobar si esta usando
`langgraph` o `sequential_fallback`.

## Despliegue en Railway

Crear un servicio independiente para esta carpeta:

```txt
Root directory: ai-service
Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variables minimas:

```env
AI_SERVICE_ENV=production
RUMIANDO_API_URL=https://rumiando-v2-production.up.railway.app/api
ALLOWED_ORIGINS=https://rumiando.netlify.app,https://rumiando-v2-production.up.railway.app
CHAT_HISTORY_MODE=none
MAX_HISTORY_MESSAGES=20
USE_LLM=false
OPENAI_FALLBACK_ON_UNKNOWN=true
OPENAI_STORE=false
SAVE_UNRESOLVED_QUESTIONS=true
ANONYMIZE_UNRESOLVED_QUESTIONS=true
LEARNING_USE_OPENAI_REFORMULATION=false
LEARNING_QUEUE_TOKEN=token_largo_privado
OPENAI_API_KEY=solo_si_se_quiere_fallback_openai
```

Despues, en el backend Node desplegado, configurar:

```env
AI_SERVICE_URL=https://url-del-servicio-ai-service.up.railway.app
LEARNING_QUEUE_TOKEN=mismo_token_largo_privado
```

Si `POST /api/ai/chat` devuelve "ruta no encontrada", el backend Node desplegado
no tiene montada la ruta `/api/ai` o no se ha redeployado con el ultimo commit.
Si la ruta existe pero falla la conexion, revisar `AI_SERVICE_URL`.

