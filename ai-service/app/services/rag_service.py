import re
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings
from app.schemas import RagSource


SUPPORTED_SUFFIXES = {".md", ".txt"}
STOPWORDS = {
    "a", "al", "ante", "con", "de", "del", "el", "en", "es", "la", "las",
    "lo", "los", "para", "por", "que", "se", "si", "sin", "un", "una",
    "y", "o", "como", "cuando", "donde", "sobre"
}


@dataclass
class KnowledgeChunk:
    source_id: str
    file: str
    title: str
    text: str
    tokens: set[str]


def _normalize(text):
    return (
        text.lower()
        .replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )


def _tokens(text):
    return {
        token
        for token in re.findall(r"[a-zA-Z0-9_-]{3,}", _normalize(text))
        if token not in STOPWORDS
    }


def _title_for(text, fallback):
    for line in text.splitlines():
        clean = line.strip()
        if clean.startswith("#"):
            return clean.lstrip("#").strip() or fallback
    return fallback


def _chunk_text(text, max_chars=1400):
    sections = re.split(r"\n(?=#{1,3}\s)", text)
    chunks = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        if len(section) <= max_chars:
            chunks.append(section)
            continue

        paragraphs = [item.strip() for item in section.split("\n\n") if item.strip()]
        current = []
        current_len = 0

        for paragraph in paragraphs:
            if current and current_len + len(paragraph) > max_chars:
                chunks.append("\n\n".join(current))
                current = []
                current_len = 0

            current.append(paragraph)
            current_len += len(paragraph)

        if current:
            chunks.append("\n\n".join(current))

    return chunks


def load_knowledge_chunks():
    settings = get_settings()
    chunks = []

    for path in sorted(settings.knowledge_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue

        if path.name.lower() == "readme.md":
            continue

        text = path.read_text(encoding="utf-8").strip()
        if not text:
            continue

        relative_file = str(path.relative_to(settings.knowledge_dir)).replace("\\", "/")
        document_title = _title_for(text, path.stem)

        for index, chunk in enumerate(_chunk_text(text), start=1):
            chunk_tokens = _tokens(chunk)
            if not chunk_tokens:
                continue

            chunks.append(
                KnowledgeChunk(
                    source_id=f"{relative_file}#{index}",
                    file=relative_file,
                    title=document_title,
                    text=chunk,
                    tokens=chunk_tokens
                )
            )

    return chunks


def search_documents(query, limit=4):
    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    scored = []
    for chunk in load_knowledge_chunks():
        overlap = query_tokens.intersection(chunk.tokens)
        if not overlap:
            continue

        score = len(overlap) / max(len(query_tokens), 1)
        scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)

    return [
        RagSource(
            source_id=chunk.source_id,
            file=chunk.file,
            title=chunk.title,
            excerpt=chunk.text[:520],
            score=round(score, 3)
        )
        for score, chunk in scored[:limit]
    ]


def count_documents():
    settings = get_settings()
    return len([
        path
        for path in settings.knowledge_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_SUFFIXES
        and path.name.lower() != "readme.md"
    ])

