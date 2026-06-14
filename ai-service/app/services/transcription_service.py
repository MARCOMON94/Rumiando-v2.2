import os
import tempfile
import threading

from fastapi import HTTPException

from app.config import get_settings


_MODEL = None
_MODEL_KEY = None
_MODEL_LOCK = threading.Lock()


def _suffix_for_mime_type(mime_type: str | None) -> str:
    clean = (mime_type or "").lower()
    if "mp4" in clean or "m4a" in clean:
        return ".m4a"
    if "mpeg" in clean or "mp3" in clean:
        return ".mp3"
    if "wav" in clean:
        return ".wav"
    if "ogg" in clean:
        return ".ogg"
    return ".webm"


def _load_model():
    global _MODEL, _MODEL_KEY

    settings = get_settings()
    model_key = (
        settings.local_whisper_model,
        settings.local_whisper_device,
        settings.local_whisper_compute_type,
        settings.local_whisper_download_root,
    )

    with _MODEL_LOCK:
        if _MODEL is not None and _MODEL_KEY == model_key:
            return _MODEL

        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise HTTPException(
                status_code=503,
                detail="Whisper local no esta instalado. Instala las dependencias de ai-service.",
            ) from exc

        kwargs = {
            "device": settings.local_whisper_device,
            "compute_type": settings.local_whisper_compute_type,
        }
        if settings.local_whisper_download_root:
            kwargs["download_root"] = settings.local_whisper_download_root

        _MODEL = WhisperModel(settings.local_whisper_model, **kwargs)
        _MODEL_KEY = model_key
        return _MODEL


def transcribe_audio_bytes(audio: bytes, mime_type: str | None = None, language: str | None = None):
    settings = get_settings()

    if not audio:
        raise HTTPException(status_code=400, detail="No se recibio audio para transcribir")

    if len(audio) > settings.local_whisper_max_bytes:
        raise HTTPException(status_code=413, detail="El audio supera el limite permitido")

    fd, path = tempfile.mkstemp(prefix="rumiando-voice-", suffix=_suffix_for_mime_type(mime_type))

    try:
        with os.fdopen(fd, "wb") as tmp:
            tmp.write(audio)

        model = _load_model()
        segments, info = model.transcribe(
            path,
            language=language or settings.local_whisper_language or "es",
            beam_size=settings.local_whisper_beam_size,
            vad_filter=settings.local_whisper_vad_filter,
        )
        text = " ".join(segment.text.strip() for segment in segments if segment.text).strip()

        if not text:
            raise HTTPException(status_code=422, detail="No se entendio ningun texto en el audio")

        return {
            "text": text,
            "provider": "local-whisper",
            "model": settings.local_whisper_model,
            "language": getattr(info, "language", language or settings.local_whisper_language or "es"),
        }
    finally:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
