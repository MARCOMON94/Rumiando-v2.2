import json
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from app.config import get_settings
from app.schemas import ToolCall


def _normalize(text):
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


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

    explicit_search_words = [
        "busca", "buscar", "encuentra", "localiza", "ficha",
        "crotal", "rfid", "lector", "lectura", "identificador", "id animal"
    ]

    has_search_intent = any(word in normalized for word in explicit_search_words)
    tokens = re.findall(r"\b(?:es[-_]?)?[a-z]{0,4}\d[a-z0-9_/-]{2,}\b", normalized)

    if has_search_intent and tokens:
        return tokens[0]

    match = re.search(
        r"(?:crotal|rfid|lector|lectura|identificador|id animal)\s+([a-z0-9_/-]*\d[a-z0-9_/-]*)",
        normalized
    )
    if match:
        return match.group(1)

    return None


def _has_movement_intent(normalized):
    if any(phrase in normalized for phrase in ["pasa algo", "que pasa si", "puede pasar algo"]):
        return False

    action_words = [
        "mover", "mueve", "movimiento", "trasladar", "traslada",
        "pasar", "pasa", "meter", "mete", "apartar", "aparta",
        "cambio de corral", "cambiar de corral"
    ]
    context_words = [
        "corral", "lote", "crotales", "rfid", "lector", "paridas",
        "gestantes", "secado", "lazareto", "reposicion", "cebo"
    ]

    return (
        any(word in normalized for word in action_words)
        and any(word in normalized for word in context_words)
    )


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

    if _has_movement_intent(normalized):
        calls.append(ToolCall(
            name="preparar_cambio_corral",
            status="ok",
            input={"message": message},
            output_summary=(
                "Cambio de corral detectado. La IA puede preparar animales, destino "
                "y resumen, pero la ejecucion definitiva queda pendiente de rutas finales "
                "y confirmacion del usuario."
            ),
            data={
                "requires_confirmation": True,
                "action_type": "CHANGE_PEN_PENDING_FINAL_ROUTES"
            }
        ))

    return calls
