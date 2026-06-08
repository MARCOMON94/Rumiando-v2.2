import json
from threading import Lock
from uuid import uuid4

from app.config import get_settings
from app.schemas import ChatMessage


_LOCK = Lock()


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


def append_message(conversation_id, role, content):
    settings = get_settings()
    message = ChatMessage(role=role, content=content)

    with _LOCK:
        store = _read_store()
        messages = store.setdefault(conversation_id, [])
        messages.append(message.model_dump())
        store[conversation_id] = messages[-settings.max_history_messages:]
        _write_store(store)

    return message


def get_history(conversation_id):
    with _LOCK:
        store = _read_store()
        return [
            ChatMessage(**message)
            for message in store.get(conversation_id, [])
        ]

