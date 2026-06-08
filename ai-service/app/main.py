from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware

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
def unresolved_questions(limit: int = 100):
    return {
        "items": list_unresolved_questions(limit=limit)
    }

