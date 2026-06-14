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
    "respira mal", "no respira", "asfixia", "sangre", "sangrando", "herida",
    "cojo", "coja", "cojera", "convulsion", "ataque", "ubre",
    "mastitis", "parto", "aborto", "dolor", "vomita", "vomitos",
    "pico abierto", "no se mueve", "orina", "veneno", "toxica", "toxico",
    "no puede mear", "no hace pis", "no mea", "intenta mear",
    "pisado", "pisada", "pisoton", "atropelle", "atropellado",
    "no mueve la pata", "no apoya la pata", "se comio", "comio un pato",
    "he sacado la pata", "he sacado la cria", "he jalado", "he tirado",
    "solo saco una pata", "pata en la mano",
    "espuma por la boca", "se ha muerto", "se murio", "sale gas",
    "saliendo gas", "pincho", "pinchar", "chilla", "cuello roto",
    "solo mueve los ojos", "cayo del techo", "cayo de alto",
    "le ha caido una piedra", "le cayo una piedra", "le ha caido algo encima",
    "le cayo algo encima", "piedra encima", "pario", "parida", "parida reciente", "recien parida",
"cria", "crias", "cordero recien nacido", "cabrito recien nacido",
"calostro", "no ha mamado", "no mama", "no se engancha",
"madre desconocida", "no se cual es la madre", "abandono de cria",
"cria tirada", "dejo a la cria", "rechaza la cria"
]

MANAGEMENT_TERMS = [
    "duermen", "dormir", "conviven", "convivir", "juntos", "juntas",
    "mezclar", "compartir", "mismo corral", "misma nave", "misma cama",
    "pueden estar", "puedo tener",
    "bioseguridad", "cuarentena", "paridera", "cama", "comedero", "bebedero"
]

APP_CONTEXT_TERMS = [
    "corral", "lote", "rfid", "crotal", "lector", "lectura", "paridas",
    "gestantes", "secado", "lazareto", "reposicion", "cebo", "estado",
    "caso", "aviso", "recordatorio", "tratamiento", "baja", "movimiento",
    "ficha", "animal", "animales", "especie", "especies", "catalogo",
    "catalogos", "unidad rega", "rega", "vacuna", "vacunacion",
    "desparasitacion", "desparasitar", "evento reproductivo",
    "medica", "medicar", "medicado", "trata", "tratar", "tratado",
    "vacunar", "vacunado", "desparasita", "desparasitado",
    "gestacion", "gestacional", "parto", "exportacion", "endpoint", "ruta"
]

APP_QUERY_TERMS = [
    "aviso", "avisos", "recordatorio", "recordatorios", "pendiente", "pendientes",
    "dashboard", "resumen", "explotacion", "busca", "buscar", "encuentra",
    "localiza", "ficha", "crotal", "rfid", "lector", "lectura", "identificador",
    "donde esta", "en que corral", "rega", "unidad rega", "numero rega",
    "codigo rega", "cuantas", "cuantos", "cuanto ganado", "numero de animales",
    "ovejas tengo", "cabras tengo", "animales tengo", "por especie",
    "por estado", "por corral", "en produccion", "en lactacion",
    "corrales tengo", "corrales", "catalogo", "catalogos", "movimientos",
    "casos sanitarios", "tratamientos", "vacunaciones", "desparasitaciones",
    "eventos reproductivos", "endpoints", "rutas", "que puedes hacer",
    "herramientas", "acciones disponibles"
]

MOVEMENT_PLACE_TERMS = [
    "produccion", "productoras", "lactacion", "lactancia", "ordeno",
    "secado", "secas", "seca", "gestantes", "gestante", "prenadas",
    "prenada", "paridera", "paridas", "parida", "cebo", "reposicion",
    "recria", "lazareto", "enfermeria"
]


def normalize_text(text):
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    replacements = [
        ("bacun", "vacun"),
        ("vacnu", "vacun"),
        ("vacn", "vacun"),
        ("vacunacin", "vacunacion"),
        ("desparacit", "desparasit"),
        ("inseminao", "inseminado"),
        ("a parido", "ha parido"),
        ("ha pario", "ha parido"),
    ]
    for before, after in replacements:
        text = text.replace(before, after)
    return text


def _contains_any(normalized, terms):
    return any(term in normalized for term in terms)


def _contains_term(normalized, term):
    if " " in term:
        return term in normalized
    return re.search(rf"\b{re.escape(term)}\b", normalized) is not None


def _contains_any_term(normalized, terms):
    return any(_contains_term(normalized, term) for term in terms)


def _species_count(normalized):
    return sum(1 for term in SPECIES_TERMS if term in normalized)


def _is_memory_question(normalized):
    patterns = [
        "que te he preguntado",
        "que preguntas te he hecho",
        "que preguntas hice",
        "cuantas cosas te he preguntado",
        "cuantas preguntas te he hecho",
        "cuantos mensajes te he mandado",
        "cuantas cosas dije",
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

    if _contains_any(normalized, [
        "que vacuna", "que tratamiento", "que medicamento", "que antibiotico",
        "que le doy", "que le pongo", "como trato", "como medico",
        "puedo darle", "puedo ponerle", "debo darle", "debo ponerle"
    ]):
        return False

    if _contains_any(normalized, ["dar de baja", "da de baja", "baja a", "baja el", "baja la"]):
        return True

    if _contains_any(normalized, [
        "acaba de parir", "acabo de parir", "ha parido", "pario",
        "recien parida", "ha tenido cria", "ha tenido crias",
        "se ha muerto", "se murio", "ha muerto", "esta muerto",
        "esta muerta", "murio", "muerte", "fallecio", "fallecido", "fallecida",
        "he inseminado", "inseminado", "insemine", "cubri", "echar macho"
    ]):
        return True

    place_pattern = "|".join(re.escape(term) for term in MOVEMENT_PLACE_TERMS)
    if re.search(
        rf"\b(?:de|desde)\s+(?:el\s+)?(?:corral\s+|lote\s+)?(?:{place_pattern})\s+(?:a|al|hacia|para)\s+(?:el\s+)?(?:corral\s+|lote\s+)?(?:{place_pattern})\b",
        normalized
    ):
        return True

    movement_words = [
        "mover", "mueve", "muevo", "traslada", "trasladar", "pasar",
        "pasa", "pasa al", "pasa a", "mete", "meter", "aparta", "apartar",
        "cambiar", "cambia", "cambias", "cambiamos",
        "cambiar de sitio", "cambia de sitio", "cambio de sitio",
        "cambiar ovejas de sitio", "cambiar cabras de sitio"
    ]
    has_movement = _contains_any(normalized, movement_words)
    movement_species_context = [
        "oveja", "ovejas", "cabra", "cabras", "cordero", "corderos",
        "cabrito", "cabritos", "ganado", "rebano", "sitio"
    ]
    has_app_context = _contains_any(normalized, APP_CONTEXT_TERMS + movement_species_context)
    if has_movement and has_app_context:
        return True

    direct_action = re.search(
        r"\b(crea|crear|borra|borrar|actualiza|actualizar|registra|registrar|anade|anadir|guarda|guardar|alta|nuevo|nueva|modifica|modificar|cambia|cambiar|cambias|abre|abrir|cierra|cerrar|completa|completar|pospone|posponer|exporta|exportar|envia|enviar|pon|poner|aplica|aplicar|vacuna|vacunar|vacune|vacunado|medica|medicar|trata|tratar|desparasita|desparasitar|inseminar|inseminado|insemine|cubrir|cubri)\b",
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

    return _contains_any_term(normalized, HEALTH_TERMS) and (
        _species_count(normalized) > 0
        or _contains_any(normalized, ["animal", "animales", "cria", "crias"])
    )


def classify_intent(message, triage=None):
    normalized = normalize_text(message)

    if _is_memory_question(normalized):
        return IntentResult(kind="memory", reason="pregunta sobre historial")

    action = _is_app_action_request(normalized)

    if _is_app_data_query(normalized):
        return IntentResult(kind="app_query", reason="consulta de datos de app")

    if (
        action
        and triage
        and triage.code == "generic_health"
        and _contains_any(normalized, ["mover", "mueve", "trasladar", "traslada", "cambio de corral", "cambiar de corral"])
        and _contains_any(normalized, ["corral", "lote"])
    ):
        return IntentResult(kind="app_action", reason="movimiento de app con contexto de corral", requires_confirmation=True)

    if action:
        return IntentResult(kind="app_action", reason="accion de app con contexto", requires_confirmation=True)

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

    return IntentResult(kind="general", reason="consulta general")
