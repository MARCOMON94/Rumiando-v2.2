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
    max_history_messages: int = int(os.getenv("MAX_HISTORY_MESSAGES", "40"))


@lru_cache
def get_settings():
    settings = Settings()
    settings.knowledge_dir.mkdir(parents=True, exist_ok=True)
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
