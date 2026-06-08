import json
import re
import urllib.error
import urllib.parse
import urllib.request

from app.config import get_settings
from app.schemas import ToolCall


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


def _api_get(path, authorization=None):
    settings = get_settings()
    base_url = settings.rumiando_api_url.rstrip("/")
    url = f"{base_url}{path}"
    headers = {"Accept": "application/json"}

    if authorization:
        headers["Authorization"] = authorization

    request = urllib.request.Request(url, headers=headers, method="GET")

    with urllib.request.urlopen(request, timeout=8) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def _animal_query_from_message(message):
    normalized = _normalize(message)
    match = re.search(r"(?:crotal|animal|oveja|cabra)\s+([a-z0-9_/-]{3,})", normalized)
    if match:
        return match.group(1)

    tokens = re.findall(r"\b[a-z]{0,4}\d[a-z0-9_/-]{2,}\b", normalized)
    return tokens[0] if tokens else None


def _summarize_animals(data):
    animals = data.get("data") if isinstance(data, dict) else []
    if not animals:
        return "No se encontraron animales con ese criterio."

    lines = []
    for animal in animals[:5]:
        lines.append(
            " - {crotal}: {sexo}, {especie}, corral {corral}".format(
                crotal=animal.get("crotal") or "sin crotal",
                sexo=animal.get("sexo") or "sin sexo",
                especie=(animal.get("especie") or {}).get("nombre") or "sin especie",
                corral=(animal.get("corralActual") or {}).get("nombre") or "sin corral"
            )
        )

    total = data.get("total", len(animals))
    return f"Animales encontrados: {total}.\n" + "\n".join(lines)


def _summarize_reminders(data):
    reminders = data.get("data") if isinstance(data, dict) else []
    if not reminders:
        return "No hay avisos pendientes devueltos por la API."

    lines = []
    for reminder in reminders[:5]:
        lines.append(
            " - {title} ({date})".format(
                title=reminder.get("titulo") or reminder.get("tipo") or "Aviso",
                date=reminder.get("fechaObjetivo") or "sin fecha"
            )
        )

    total = data.get("total", len(reminders))
    return f"Avisos pendientes encontrados: {total}.\n" + "\n".join(lines)


def _summarize_dashboard(data):
    totals = data.get("totals") if isinstance(data, dict) else {}
    if not totals:
        return "La API no devolvio totales de dashboard."

    return (
        "Resumen de explotacion: "
        f"{totals.get('totalAnimals', 'N/D')} animales, "
        f"{totals.get('totalPens', 'N/D')} corrales, "
        f"{totals.get('activeHealthCases', 'N/D')} casos sanitarios activos."
    )


def _safe_call(name, input_data, summary_builder, callback):
    try:
        data = callback()
        return ToolCall(
            name=name,
            status="ok",
            input=input_data,
            output_summary=summary_builder(data),
            data=data if isinstance(data, dict) else None
        )
    except urllib.error.HTTPError as err:
        return ToolCall(
            name=name,
            status="error",
            input=input_data,
            output_summary=f"La API principal respondio con estado {err.code}."
        )
    except Exception as err:
        return ToolCall(
            name=name,
            status="error",
            input=input_data,
            output_summary=f"No se pudo consultar la API principal: {err}"
        )


def run_app_tools(message, authorization=None):
    normalized = _normalize(message)
    calls = []

    animal_query = _animal_query_from_message(message)
    if animal_query:
        query = urllib.parse.urlencode({"search": animal_query})
        calls.append(_safe_call(
            "buscar_animal_por_crotal",
            {"query": animal_query},
            _summarize_animals,
            lambda: _api_get(f"/animals?{query}", authorization)
        ))

    if any(word in normalized for word in ["aviso", "avisos", "recordatorio", "pendiente"]):
        calls.append(_safe_call(
            "listar_avisos_pendientes",
            {},
            _summarize_reminders,
            lambda: _api_get("/reminders?pending=true", authorization)
        ))

    if any(word in normalized for word in ["dashboard", "resumen", "explotacion"]):
        calls.append(_safe_call(
            "consultar_dashboard",
            {},
            _summarize_dashboard,
            lambda: _api_get("/dashboard", authorization)
        ))

    if any(word in normalized for word in ["mover", "movimiento", "trasladar", "corral"]):
        calls.append(ToolCall(
            name="preparar_movimiento",
            status="ok",
            input={"message": message},
            output_summary=(
                "Movimiento detectado. La IA puede preparar datos, pero la accion "
                "debe confirmarse en el formulario de movimientos."
            ),
            data={"requires_confirmation": True}
        ))

    return calls
