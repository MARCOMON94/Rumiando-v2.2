import json
import re
import unicodedata
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
    settings = get_settings()

    if not settings.save_unresolved_questions:
        return None

    redacted_message = (
        _redact_sensitive_text(message)
        if settings.anonymize_unresolved_questions
        else message
    )

    normalized_message = _normalize_text(redacted_message)

    item = {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review",
        "reason": reason,

        "message_redacted": redacted_message,
        "message_normalized": normalized_message,

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

        "answer_preview": (
            _redact_sensitive_text(answer_preview)
            if answer_preview and settings.anonymize_unresolved_questions
            else answer_preview
        ),

        "suggested_knowledge_action": _knowledge_action_for(intent, triage)
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
    
    def _normalize_text(text):
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _redact_sensitive_text(text):
    text = text or ""

    # Emails
    text = re.sub(r"\b[\w\.-]+@[\w\.-]+\.\w+\b", "[EMAIL]", text)

    # Telefonos simples
    text = re.sub(r"\b(?:\+34\s?)?\d{9}\b", "[TELEFONO]", text)

    # DNIs/NIEs aproximados
    text = re.sub(r"\b\d{8}[A-Z]\b", "[DNI]", text, flags=re.IGNORECASE)
    text = re.sub(r"\b[XYZ]\d{7}[A-Z]\b", "[NIE]", text, flags=re.IGNORECASE)

    # Crotales o IDs tipo ES0001, ES-12345, etc.
    text = re.sub(r"\bES[-_]?[A-Z0-9]{3,}\b", "[CROTAL]", text, flags=re.IGNORECASE)

    # Frases frecuentes con personas
    text = re.sub(r"\bmi hijo\b", "[PERSONA]", text, flags=re.IGNORECASE)
    text = re.sub(r"\bmi padre\b", "[PERSONA]", text, flags=re.IGNORECASE)
    text = re.sub(r"\bmi madre\b", "[PERSONA]", text, flags=re.IGNORECASE)

    return text.strip()


def _knowledge_action_for(intent, triage):
    triage_code = getattr(triage, "code", "general")
    intent_kind = getattr(intent, "kind", "unknown")

    if intent_kind == "veterinary":
        return f"Revisar si falta ampliar knowledge/10_sanidad o knowledge/00_triaje para triage_code={triage_code}"

    if intent_kind in {"app_query", "app_action"}:
        return "Revisar si falta ampliar knowledge/40_app_flujos"

    if intent_kind == "management":
        return "Revisar si falta ampliar knowledge/20_manejo"

    return "Revisar si hace falta nuevo documento o ampliar knowledge general"
