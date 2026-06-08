import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parents[1]

try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except Exception:
    pass


def _split_csv(value):
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseModel):
    service_name: str = os.getenv("AI_SERVICE_NAME", "RumiAndo AI Service")
    environment: str = os.getenv("AI_SERVICE_ENV", "development")
    rumiando_api_url: str = os.getenv("RUMIANDO_API_URL", "http://localhost:3000/api")
    allowed_origins: list[str] = _split_csv(
        os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
    )
    knowledge_dir: Path = BASE_DIR / "knowledge"
    storage_dir: Path = BASE_DIR / "storage"
    history_file: Path = BASE_DIR / "storage" / "chat_history.json"
    unresolved_questions_file: Path = BASE_DIR / "storage" / "unresolved_questions.json"
    max_history_messages: int = int(os.getenv("MAX_HISTORY_MESSAGES", "40"))
    chroma_dir: Path = BASE_DIR / "storage" / "chroma"
    use_chroma: bool = os.getenv("USE_CHROMA", "true").lower() == "true"
    chroma_collection: str = os.getenv("CHROMA_COLLECTION", "rumiando_knowledge")
    local_embedding_dimensions: int = int(os.getenv("LOCAL_EMBEDDING_DIMENSIONS", "384"))
    include_debug_sections_in_answer: bool = os.getenv("INCLUDE_DEBUG_SECTIONS_IN_ANSWER", "false").lower() == "true"
    include_safety_notice_in_answer: bool = os.getenv("INCLUDE_SAFETY_NOTICE_IN_ANSWER", "false").lower() == "true"
    openai_fallback_on_unknown: bool = os.getenv("OPENAI_FALLBACK_ON_UNKNOWN", "false").lower() == "true"
    use_llm: bool = os.getenv("USE_LLM", "false").lower() == "true"
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
    openai_max_output_tokens: int = int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "350"))
    chat_history_mode: str = os.getenv("CHAT_HISTORY_MODE", "memory")
    chat_history_ttl_minutes: int = int(os.getenv("CHAT_HISTORY_TTL_MINUTES", "60"))
    save_unresolved_questions: bool = os.getenv("SAVE_UNRESOLVED_QUESTIONS", "true").lower() == "true"
    anonymize_unresolved_questions: bool = os.getenv("ANONYMIZE_UNRESOLVED_QUESTIONS", "true").lower() == "true"
    openai_store: bool = os.getenv("OPENAI_STORE", "false").lower() == "true"
    learning_queue_token: str | None = os.getenv("LEARNING_QUEUE_TOKEN")


@lru_cache
def get_settings():
    settings = Settings()
    settings.knowledge_dir.mkdir(parents=True, exist_ok=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    return settings
