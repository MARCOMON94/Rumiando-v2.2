from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Header, HTTPException
from app.config import get_settings
from app.services.learning_queue import list_unresolved_questions
from app.config import get_settings
from app.schemas import ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.agent import build_chat_response
from app.services.history_store import get_history
from app.services.learning_queue import list_unresolved_questions
from app.services.rag_service import count_documents, rag_status



settings = get_settings()

app = FastAPI(
    title=settings.service_name,
    version="0.1.0",
    description="Servicio IA para el MVP de RumiAndo."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

def _check_learning_token(authorization: str | None):
    settings = get_settings()

    if not settings.learning_queue_token:
        raise HTTPException(status_code=503, detail="Learning queue token not configured")

    expected = f"Bearer {settings.learning_queue_token}"

    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

@app.get("/")
def root():
    return {
        "message": settings.service_name,
        "docs": "/docs",
        "health": "/api/health"
    }


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "service": settings.service_name,
        "environment": settings.environment,
        "rag_documents_indexed": count_documents(),
        "rag": rag_status()
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, authorization: str | None = Header(default=None)):
    return build_chat_response(request, authorization)


@app.get("/api/chat/history/{conversation_id}", response_model=ChatHistoryResponse)
def chat_history(conversation_id: str):
    return ChatHistoryResponse(
        conversation_id=conversation_id,
        messages=get_history(conversation_id)
    )


@app.get("/api/learning/unresolved")
def get_unresolved_questions(limit: int = 100, authorization: str | None = Header(default=None)):
    _check_learning_token(authorization)

    return {
        "items": list_unresolved_questions(limit=limit)
    }


@app.get("/api/learning/weekly-summary")
def get_learning_weekly_summary(authorization: str | None = Header(default=None)):
    _check_learning_token(authorization)

    items = list_unresolved_questions(limit=100)

    pending = [
        item for item in items
        if item.get("status") == "pending_review"
    ]

    by_triage = {}
    for item in pending:
        key = item.get("triage_code", "unknown")
        by_triage[key] = by_triage.get(key, 0) + 1

    return {
        "total_pending": len(pending),
        "by_triage_code": by_triage,
        "items": pending[:50]
    }