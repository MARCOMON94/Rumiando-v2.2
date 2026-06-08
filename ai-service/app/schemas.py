from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: str = Field(default_factory=utc_now_iso)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


class RagSource(BaseModel):
    source_id: str
    file: str
    title: str
    excerpt: str
    score: float


class ToolCall(BaseModel):
    name: str
    status: Literal["ok", "skipped", "error"]
    input: dict[str, Any] = Field(default_factory=dict)
    output_summary: str
    data: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    conversation_id: str = Field(default_factory=lambda: str(uuid4()))
    answer: str
    sources: list[RagSource] = Field(default_factory=list)
    tool_calls: list[ToolCall] = Field(default_factory=list)
    requires_confirmation: bool = False
    safety_notice: str | None = None


class ChatHistoryResponse(BaseModel):
    conversation_id: str
    messages: list[ChatMessage]

