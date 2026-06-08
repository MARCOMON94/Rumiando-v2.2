import json
import re
import unicodedata
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from app.config import get_settings
from app.services.llm_service import build_learning_case_summary
from app.services.privacy import redact_sensitive_text


_LOCK = Lock()
_MAX_ITEMS = 500


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


def _normalize_text(text):
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _local_case_summary(message_redacted, intent, triage):
    normalized = _normalize_text(message_redacted)
    triage_code = getattr(triage, "code", "general")
    priority = getattr(triage, "priority", "LOW")
    intent_kind = getattr(intent, "kind", "unknown")

    if any(term in normalized for term in ["veneno", "toxico", "toxica", "intoxicacion", "raticida"]):
        return {
            "case_title": "Sospecha de intoxicacion o envenenamiento en animal de granja",
            "case_summary": (
                "Consulta sobre posible exposicion a veneno o toxico en un animal. "
                "Conviene revisar actuacion segura, retirada del producto, aislamiento, "
                "revision del lote, preservacion de envase/muestras y aviso veterinario."
            ),
            "knowledge_gap": "Ampliar protocolo ante intoxicacion o envenenamiento, incluido caso intencional."
        }

    if any(term in normalized for term in ["calostro", "no mama", "madre desconocida", "cria tirada"]):
        return {
            "case_title": "Cria recien nacida sin madre confirmada o sin calostro",
            "case_summary": (
                "Consulta sobre cria neonata con duda de madre y de ingesta de calostro. "
                "Revisar manejo neonatal, identificacion de madre, prioridad, abrigo, "
                "alimentacion segura y registro en la app."
            ),
            "knowledge_gap": "Ampliar protocolo neonatal sobre calostro, abandono y madre desconocida."
        }

    if any(term in normalized for term in ["leche", "bebi", "bebido", "probe", "probado"]):
        return {
            "case_title": "Exposicion humana a leche sospechosa o no apta",
            "case_summary": (
                "Consulta sobre consumo o prueba de leche de un animal con ubre alterada o leche sospechosa. "
                "Revisar respuesta para persona expuesta, grupos vulnerables, sintomas de alarma y manejo de leche."
            ),
            "knowledge_gap": "Ampliar protocolo de exposicion humana accidental a leche cruda o leche sospechosa."
        }

    if any(term in normalized for term in ["pata", "parto", "aborto", "placenta", "matriz"]):
        return {
            "case_title": "Parto, aborto o posparto con posible complicacion",
            "case_summary": (
                "Consulta sobre reproduccion con posible parto atascado, aborto incompleto, restos retenidos "
                "o manipulacion de cria/feto. Revisar urgencia, no tirar, higiene, aislamiento y aviso veterinario."
            ),
            "knowledge_gap": "Ampliar familias de respuesta para parto bloqueado, aborto y posparto complicado."
        }

    if any(term in normalized for term in ["convulsion", "temblor", "moviendo las patas", "pedalea"]):
        return {
            "case_title": "Signos neurologicos o convulsiones en animal de granja",
            "case_summary": (
                "Consulta sobre animal tumbado, pedaleando, temblando o con signos neurologicos. "
                "Revisar actuacion inmediata, seguridad del animal, toxicos posibles y aviso veterinario."
            ),
            "knowledge_gap": "Ampliar familias de urgencia neurologica y convulsiones por especie."
        }

    return {
        "case_title": f"Caso pendiente de revision: {triage_code}",
        "case_summary": (
            "Consulta que no quedo cubierta de forma suficiente por reglas locales o documentos RAG. "
            f"Prioridad local {priority}, intent {intent_kind}. Revisar si debe anadirse contenido a knowledge."
        ),
        "knowledge_gap": f"Revisar cobertura para intent={intent_kind} y triage_code={triage_code}."
    }


def _parse_llm_summary(raw_summary):
    if not raw_summary:
        return None

    text = raw_summary.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None

    required = {"case_title", "case_summary", "knowledge_gap"}
    if not isinstance(payload, dict) or not required.issubset(payload):
        return None

    return {
        "case_title": str(payload["case_title"])[:180],
        "case_summary": str(payload["case_summary"])[:800],
        "knowledge_gap": str(payload["knowledge_gap"])[:500],
        "suggested_tags": payload.get("suggested_tags", [])
    }


def _build_case_summary(message_redacted, intent, triage):
    settings = get_settings()
    local_summary = _local_case_summary(message_redacted, intent, triage)

    if not settings.learning_use_openai_reformulation:
        return local_summary

    llm_summary = _parse_llm_summary(
        build_learning_case_summary(message_redacted, triage=triage, intent=intent)
    )
    return llm_summary or local_summary


def _knowledge_action_for(intent, triage):
    triage_code = getattr(triage, "code", "general")
    intent_kind = getattr(intent, "kind", "unknown")

    if intent_kind == "veterinary":
        return f"Revisar knowledge/10_sanidad o knowledge/00_triaje para triage_code={triage_code}"

    if intent_kind in {"app_query", "app_action"}:
        return "Revisar knowledge/40_app_flujos"

    if intent_kind == "management":
        return "Revisar knowledge/20_manejo"

    return "Revisar si hace falta nuevo documento o ampliar knowledge general"


def add_unresolved_question(
    message,
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
        redact_sensitive_text(message)
        if settings.anonymize_unresolved_questions
        else message
    )
    normalized_message = _normalize_text(redacted_message)
    case_summary = _build_case_summary(redacted_message, intent, triage)

    redacted_answer_preview = (
        redact_sensitive_text(answer_preview)
        if answer_preview and settings.anonymize_unresolved_questions
        else answer_preview
    )

    item = {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review",
        "reason": reason,
        "case_title": case_summary["case_title"],
        "case_summary": case_summary["case_summary"],
        "knowledge_gap": case_summary["knowledge_gap"],
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
            for source in (sources or [])[:5]
        ],
        "answer_preview": redacted_answer_preview,
        "suggested_knowledge_action": _knowledge_action_for(intent, triage)
    }

    if case_summary.get("suggested_tags"):
        item["suggested_tags"] = case_summary["suggested_tags"]

    with _LOCK:
        items = _read_items()
        items.append(item)
        _write_items(items[-_MAX_ITEMS:])

    return item


def list_unresolved_questions(limit=100):
    with _LOCK:
        items = _read_items()
        return list(reversed(items))[:limit]


def build_weekly_summary(limit=100):
    items = list_unresolved_questions(limit=limit)
    pending = [
        item for item in items
        if item.get("status") == "pending_review"
    ]

    by_triage = {}
    by_action = {}
    for item in pending:
        triage_code = item.get("triage_code", "unknown")
        action = item.get("suggested_knowledge_action", "unknown")
        by_triage[triage_code] = by_triage.get(triage_code, 0) + 1
        by_action[action] = by_action.get(action, 0) + 1

    return {
        "total_pending": len(pending),
        "by_triage_code": by_triage,
        "by_suggested_action": by_action,
        "items": pending[:50]
    }
