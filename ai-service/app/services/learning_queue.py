import json
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from app.config import get_settings


_LOCK = Lock()


def _read_items():
    settings = get_settings()
    if not settings.unresolved_questions_file.exists():
        return []

    try:
        return json.loads(settings.unresolved_questions_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def _write_items(items):
    settings = get_settings()
    settings.unresolved_questions_file.write_text(
        json.dumps(items, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def add_unresolved_question(
    message,
    conversation_id,
    intent,
    triage,
    sources,
    reason,
    answer_preview=None
):
    item = {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review",
        "reason": reason,
        "conversation_id": conversation_id,
        "message": message,
        "intent": getattr(intent, "kind", "unknown"),
        "triage_code": getattr(triage, "code", "general"),
        "triage_priority": getattr(triage, "priority", "LOW"),
        "sources": [
            {
                "source_id": source.source_id,
                "file": source.file,
                "title": source.title,
                "score": source.score
            }
            for source in sources[:5]
        ],
        "answer_preview": answer_preview
    }

    with _LOCK:
        items = _read_items()
        items.append(item)
        _write_items(items[-500:])

    return item


def list_unresolved_questions(limit=100):
    with _LOCK:
        items = _read_items()
        return list(reversed(items))[:limit]
