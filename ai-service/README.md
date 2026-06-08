# RumiAndo AI Service

Servicio IA independiente para el MVP de RumiAndo.

## Arranque local

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
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

## RAG

El servicio lee documentos `.md` y `.txt` desde `ai-service/knowledge/`.
No se incluyen documentos de dominio inventados. La guia de generacion esta en
`docs/rag-documentos-necesarios.md`.

