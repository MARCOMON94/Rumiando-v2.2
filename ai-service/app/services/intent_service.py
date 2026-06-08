import re
import unicodedata
from dataclasses import dataclass


@dataclass
class IntentResult:
    kind: str
    reason: str
    requires_confirmation: bool = False
    search_query: str | None = None


SPECIES_TERMS = [
    "oveja", "ovejas", "cordero", "corderos", "cabra", "cabras",
    "cabrito", "cabritos", "perro", "perros", "gato", "gatos",
    "caballo", "yegua", "burro", "mula", "gallina", "gallinas",
    "pato", "patos", "pavo real", "pavos reales", "pavo", "pavos",
    "oca", "ocas", "ganso", "gansos", "conejo", "cerdo", "vaca"
]

HEALTH_TERMS = [
    "no come", "no bebe", "no se levanta", "tumbado", "tumbada",
    "decaido", "decaida", "fiebre", "diarrea", "tos", "mocos",
    "respira mal", "asfixia", "sangre", "sangrando", "herida",
    "cojo", "coja", "cojera", "convulsion", "ataque", "ubre",
    "mastitis", "parto", "aborto", "dolor", "vomita", "vomitos",
    "pico abierto", "no se mueve", "orina", "veneno", "toxica", "toxico",
    "pisado", "pisada", "pisoton", "atropelle", "atropellado",
    "no mueve la pata", "no apoya la pata", "se comio", "comio un pato",
    "he sacado la pata", "solo saco una pata", "pata en la mano",
    "espuma por la boca", "se ha muerto", "se murio", "sale gas",
    "saliendo gas", "pincho", "pinchar", "chilla", "cuello roto",
    "solo mueve los ojos", "cayo del techo", "cayo de alto""pario", "parida", "parida reciente", "recien parida",
"cria", "crias", "cordero recien nacido", "cabrito recien nacido",
"calostro", "no ha mamado", "no mama", "no se engancha",
"madre desconocida", "no se cual es la madre", "abandono de cria",
"cria tirada", "dejo a la cria", "rechaza la cria"
]

MANAGEMENT_TERMS = [
    "duermen", "dormir", "conviven", "convivir", "juntos", "juntas",
    "mezclar", "compartir", "mismo corral", "misma nave", "misma cama",
    "bioseguridad", "cuarentena", "paridera", "cama", "comedero", "bebedero"
]

APP_CONTEXT_TERMS = [
    "corral", "lote", "rfid", "crotal", "lector", "lectura", "paridas",
    "gestantes", "secado", "lazareto", "reposicion", "cebo", "estado",
    "caso", "aviso", "recordatorio", "tratamiento", "baja", "movimiento",
    "ficha", "animal"
]

APP_QUERY_TERMS = [
    "aviso", "avisos", "recordatorio", "recordatorios", "pendiente", "pendientes",
    "dashboard", "resumen", "explotacion", "busca", "buscar", "encuentra",
    "localiza", "ficha", "crotal", "rfid", "lector", "lectura", "identificador",
    "donde esta", "en que corral"
]


def normalize_text(text):
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def _contains_any(normalized, terms):
    return any(term in normalized for term in terms)


def _species_count(normalized):
    return sum(1 for term in SPECIES_TERMS if term in normalized)


def _is_memory_question(normalized):
    patterns = [
        "que te he preguntado",
        "que preguntas te he hecho",
        "que preguntas hice",
        "cuales han sido mis preguntas",
        "que hemos hablado",
        "de que hemos hablado",
        "que te dije antes",
        "recuerdas lo anterior",
        "recuerdas que",
        "lo de antes"
    ]
    return _contains_any(normalized, patterns)


def _is_app_action_request(normalized):
    if _contains_any(normalized, ["pasa algo", "que pasa si", "puede pasar algo"]):
        return False

    movement_words = [
        "mover", "mueve", "muevo", "traslada", "trasladar", "pasar",
        "pasa", "pasa al", "pasa a", "mete", "meter", "aparta", "apartar"
    ]
    has_movement = _contains_any(normalized, movement_words)
    has_app_context = _contains_any(normalized, APP_CONTEXT_TERMS)
    if has_movement and has_app_context:
        return True

    direct_action = re.search(
        r"\b(crea|crear|borra|borrar|actualiza|actualizar|registra|registrar|anade|anadir|guarda|guardar)\b",
        normalized
    )
    if direct_action and has_app_context:
        return True

    return False


def _is_app_data_query(normalized):
    if _contains_any(normalized, APP_QUERY_TERMS):
        return True

    return False


def _is_management_question(normalized):
    if _contains_any(normalized, MANAGEMENT_TERMS) and _species_count(normalized) >= 2:
        return True

    known_pairs = [
        "gallinas con ovejas", "gallinas con cabras", "patos con cabras",
        "patos con ovejas", "perros con ovejas", "perros con cabras",
        "gatos con ovejas", "gatos con cabras", "pavos reales con ovejas",
        "pavos reales con cabras"
    ]
    return _contains_any(normalized, known_pairs)


def _is_health_question(normalized, triage):
    if triage and triage.is_relevant:
        return True

    return _contains_any(normalized, HEALTH_TERMS) and (
        _species_count(normalized) > 0
        or _contains_any(normalized, ["animal", "animales", "cria", "crias"])
    )


def classify_intent(message, triage=None):
    normalized = normalize_text(message)

    if _is_memory_question(normalized):
        return IntentResult(kind="memory", reason="pregunta sobre historial")

    action = _is_app_action_request(normalized)

    # Sanidad gana prioridad de respuesta; la accion queda solo como confirmacion pendiente.
    if _is_health_question(normalized, triage):
        return IntentResult(
            kind="veterinary",
            reason="signos sanitarios o triaje local",
            requires_confirmation=action,
            search_query=triage.suggested_rag_query if triage and triage.is_relevant else None
        )

    if _is_management_question(normalized):
        return IntentResult(
            kind="management",
            reason="manejo o convivencia entre especies",
            search_query="manejo convivencia especies bioseguridad cuarentena aves perros gatos equinos ovino caprino"
        )

    if action:
        return IntentResult(kind="app_action", reason="accion de app con contexto", requires_confirmation=True)

    if _is_app_data_query(normalized):
        return IntentResult(kind="app_query", reason="consulta de datos de app")

    return IntentResult(kind="general", reason="consulta general")
