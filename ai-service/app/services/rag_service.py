import hashlib
import math
import re
import unicodedata
from dataclasses import dataclass

from app.config import get_settings
from app.schemas import RagSource


SUPPORTED_SUFFIXES = {".md", ".txt"}
STOPWORDS = {
    "a", "al", "ante", "con", "de", "del", "el", "en", "es", "la", "las",
    "lo", "los", "para", "por", "que", "se", "si", "sin", "un", "una",
    "y", "o", "como", "cuando", "donde", "sobre", "este", "esta", "estos",
    "estas", "tengo", "tiene", "puede", "hacer", "animal", "animales"
}


@dataclass
class KnowledgeChunk:
    source_id: str
    file: str
    title: str
    text: str
    tokens: set[str]


class LocalHashEmbeddingFunction:
    """Small deterministic embedding for local Chroma usage without API cost."""

    def __init__(self, dimensions=384):
        self.dimensions = dimensions

    def name(self):
        return "rumiando-local-hash-v1"

    def __call__(self, input):
        return [self._embed(text) for text in input]

    def _embed(self, text):
        vector = [0.0] * self.dimensions
        tokens = list(_tokens(text))

        for token in tokens:
            digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
            bucket = int.from_bytes(digest[:4], "little") % self.dimensions
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            weight = 1.0 + min(len(token), 12) / 12.0
            vector[bucket] += sign * weight

        norm = math.sqrt(sum(value * value for value in vector))
        if norm <= 0:
            return vector

        return [value / norm for value in vector]


def _normalize(text):
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


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


def _is_allowed_file(file, allowed_prefixes=None):
    if not allowed_prefixes:
        return True

    return any(file.startswith(prefix) for prefix in allowed_prefixes)


def _build_metadata(chunk):
    return {
        "source_id": chunk.source_id,
        "file": chunk.file,
        "title": chunk.title
    }


def _chroma_client():
    settings = get_settings()

    if not settings.use_chroma:
        return None

    try:
        import chromadb

        return chromadb.PersistentClient(path=str(settings.chroma_dir))
    except Exception:
        return None


def _get_collection(create=True):
    settings = get_settings()
    client = _chroma_client()
    if client is None:
        return None

    embedding_function = LocalHashEmbeddingFunction(settings.local_embedding_dimensions)

    if create:
        return client.get_or_create_collection(
            name=settings.chroma_collection,
            embedding_function=embedding_function,
            metadata={"hnsw:space": "cosine"}
        )

    try:
        return client.get_collection(
            name=settings.chroma_collection,
            embedding_function=embedding_function
        )
    except Exception:
        return None


def _lexical_search(query, limit=4, allowed_prefixes=None):
    query_tokens = _tokens(query)
    if not query_tokens:
        return []

    scored = []
    for chunk in load_knowledge_chunks():
        if not _is_allowed_file(chunk.file, allowed_prefixes):
            continue

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
            excerpt=chunk.text[:700],
            score=round(score, 3)
        )
        for score, chunk in scored[:limit]
    ]


def _chroma_search(query, limit=4, allowed_prefixes=None):
    collection = _get_collection(create=True)
    if collection is None:
        return []

    try:
        if collection.count() == 0:
            index_documents(force=False)

        n_results = limit * 8 if allowed_prefixes else limit
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            include=["documents", "metadatas", "distances"]
        )
    except Exception:
        return []

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    sources = []
    for document, metadata, distance in zip(documents, metadatas, distances):
        file = metadata.get("file", "")
        if not _is_allowed_file(file, allowed_prefixes):
            continue

        score = max(0.0, 1.0 - float(distance or 0.0))
        sources.append(
            RagSource(
                source_id=metadata.get("source_id", ""),
                file=file,
                title=metadata.get("title", file),
                excerpt=(document or "")[:700],
                score=round(score, 3)
            )
        )

    return sources[:limit]


def search_documents(query, limit=4, allowed_prefixes=None):
    chroma_results = _chroma_search(query, limit=limit, allowed_prefixes=allowed_prefixes)
    lexical_results = _lexical_search(query, limit=limit, allowed_prefixes=allowed_prefixes)

    by_id = {}
    for source in chroma_results + lexical_results:
        current = by_id.get(source.source_id)
        if current is None or source.score > current.score:
            by_id[source.source_id] = source

    merged = sorted(by_id.values(), key=lambda source: source.score, reverse=True)
    return merged[:limit]


def index_documents(force=True):
    settings = get_settings()
    client = _chroma_client()
    if client is None:
        return {
            "backend": "lexical",
            "chroma_available": False,
            "documents": count_documents(),
            "chunks": len(load_knowledge_chunks()),
            "indexed_chunks": 0
        }

    if force:
        try:
            client.delete_collection(settings.chroma_collection)
        except Exception:
            pass

    collection = _get_collection(create=True)
    chunks = load_knowledge_chunks()
    if not chunks:
        return {
            "backend": "chroma",
            "chroma_available": True,
            "documents": 0,
            "chunks": 0,
            "indexed_chunks": 0
        }

    existing = set()
    try:
        existing = set(collection.get(include=[]).get("ids", []))
    except Exception:
        existing = set()

    pending = [chunk for chunk in chunks if chunk.source_id not in existing]
    for start in range(0, len(pending), 100):
        batch = pending[start:start + 100]
        collection.add(
            ids=[chunk.source_id for chunk in batch],
            documents=[chunk.text for chunk in batch],
            metadatas=[_build_metadata(chunk) for chunk in batch]
        )

    return {
        "backend": "chroma",
        "chroma_available": True,
        "documents": count_documents(),
        "chunks": len(chunks),
        "indexed_chunks": collection.count(),
        "added_chunks": len(pending)
    }


def rag_status():
    collection = _get_collection(create=False)
    chunks = load_knowledge_chunks()

    if collection is None:
        return {
            "backend": "lexical",
            "chroma_available": False,
            "documents": count_documents(),
            "chunks": len(chunks),
            "indexed_chunks": 0
        }

    try:
        indexed_chunks = collection.count()
    except Exception:
        indexed_chunks = 0

    return {
        "backend": "chroma",
        "chroma_available": True,
        "documents": count_documents(),
        "chunks": len(chunks),
        "indexed_chunks": indexed_chunks
    }


def count_documents():
    settings = get_settings()
    return len([
        path
        for path in settings.knowledge_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in SUPPORTED_SUFFIXES
        and path.name.lower() != "readme.md"
    ])
