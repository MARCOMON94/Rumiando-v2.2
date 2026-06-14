from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.schemas import ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.agent import agent_status, build_chat_response
from app.services.history_store import get_history
from app.services.learning_queue import build_weekly_summary, list_unresolved_questions
from app.services.rag_service import count_documents, rag_status
from app.services.transcription_service import transcribe_audio_bytes



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
        "rag": rag_status(),
        "agent": agent_status(),
        "transcription": {
            "provider": "local-whisper",
            "model": settings.local_whisper_model,
            "device": settings.local_whisper_device,
            "compute_type": settings.local_whisper_compute_type,
            "language": settings.local_whisper_language,
        },
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, authorization: str | None = Header(default=None)):
    return build_chat_response(request, authorization)


@app.post("/api/transcribe")
async def transcribe(
    request: Request,
    x_audio_language: str | None = Header(default=None),
):
    return transcribe_audio_bytes(
        await request.body(),
        mime_type=request.headers.get("content-type"),
        language=x_audio_language,
    )


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
def get_learning_weekly_summary(limit: int = 100, authorization: str | None = Header(default=None)):
    _check_learning_token(authorization)
    return build_weekly_summary(limit=limit)
