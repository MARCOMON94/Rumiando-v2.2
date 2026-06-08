import json
import time
from threading import Lock
from uuid import uuid4

from app.config import get_settings
from app.schemas import ChatMessage


_LOCK = Lock()
_MEMORY_STORE = {}


def _now_ts():
    return time.time()


def _read_store():
    settings = get_settings()
    if not settings.history_file.exists():
        return {}

    try:
        return json.loads(settings.history_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _write_store(store):
    settings = get_settings()
    settings.history_file.write_text(
        json.dumps(store, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def get_or_create_conversation_id(conversation_id=None):
    return conversation_id or str(uuid4())


def _cleanup_memory_store():
    settings = get_settings()
    ttl_seconds = settings.chat_history_ttl_minutes * 60
    now = _now_ts()

    expired_ids = [
        conversation_id
        for conversation_id, payload in _MEMORY_STORE.items()
        if now - payload.get("updated_at", now) > ttl_seconds
    ]

    for conversation_id in expired_ids:
        _MEMORY_STORE.pop(conversation_id, None)


def _append_message_file(conversation_id, role, content):
    settings = get_settings()
    message = ChatMessage(role=role, content=content)

    with _LOCK:
        store = _read_store()
        messages = store.setdefault(conversation_id, [])
        messages.append(message.model_dump())
        store[conversation_id] = messages[-settings.max_history_messages:]
        _write_store(store)

    return message


def _append_message_memory(conversation_id, role, content):
    settings = get_settings()
    message = ChatMessage(role=role, content=content)

    with _LOCK:
        payload = _MEMORY_STORE.setdefault(
            conversation_id,
            {"updated_at": _now_ts(), "messages": []}
        )
        payload["updated_at"] = _now_ts()
        payload["messages"].append(message.model_dump())
        payload["messages"] = payload["messages"][-settings.max_history_messages:]
        _cleanup_memory_store()

    return message


def append_message(conversation_id, role, content):
    settings = get_settings()

    if settings.chat_history_mode == "none":
        return ChatMessage(role=role, content=content)

    if settings.chat_history_mode == "memory":
        return _append_message_memory(conversation_id, role, content)

    return _append_message_file(conversation_id, role, content)


def get_history(conversation_id):
    settings = get_settings()

    if settings.chat_history_mode == "none":
        return []

    if settings.chat_history_mode == "memory":
        with _LOCK:
            _cleanup_memory_store()
            payload = _MEMORY_STORE.get(conversation_id, {})
            return [
                ChatMessage(**message)
                for message in payload.get("messages", [])
            ]

    with _LOCK:
        store = _read_store()
        return [
            ChatMessage(**message)
            for message in store.get(conversation_id, [])
        ]
