import json
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

from app.config import get_settings
from app.schemas import ToolCall


def _normalize(text):
    text = unicodedata.normalize("NFKD", text or "")
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


def _api_post(path, payload=None, authorization=None):
    settings = get_settings()
    base_url = settings.rumiando_api_url.rstrip("/")
    url = f"{base_url}{path}"
    body = json.dumps(payload or {}).encode("utf-8")
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    if authorization:
        headers["Authorization"] = authorization

    request = urllib.request.Request(url, data=body, headers=headers, method="POST")

    with urllib.request.urlopen(request, timeout=12) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {}


READ_ENDPOINTS = [
    {
        "key": "dashboard",
        "label": "Resumen de explotacion",
        "method": "GET",
        "path": "/dashboard",
        "description": "Totales de animales, especies, corrales, estados reproductivos, movimientos y avisos.",
    },
    {
        "key": "animals",
        "label": "Animales",
        "method": "GET",
        "path": "/animals",
        "description": "Listado y busqueda por crotal, RFID, especie, sexo, estado, corral o unidad REGA.",
    },
    {
        "key": "animal_detail",
        "label": "Ficha de animal",
        "method": "GET",
        "path": "/animals/:id",
        "description": "Ficha completa con historial reproductivo, sanitario, movimientos, vacunas y avisos.",
    },
    {
        "key": "catalogs",
        "label": "Catalogos",
        "method": "GET",
        "path": "/catalogs",
        "description": "Especies, razas, estados reproductivos, corrales, enfermedades y unidades REGA activas.",
    },
    {
        "key": "pens",
        "label": "Corrales",
        "method": "GET",
        "path": "/pens",
        "description": "Corrales, capacidad, unidad REGA, estado sugerido y animales actuales.",
    },
    {
        "key": "farm_units",
        "label": "Unidades REGA",
        "method": "GET",
        "path": "/farm-units",
        "description": "Unidades REGA registradas, codigo, municipio, provincia y estado.",
    },
    {
        "key": "movements",
        "label": "Movimientos",
        "method": "GET",
        "path": "/movements",
        "description": "Movimientos de lote/corral con resumen de crotales procesados.",
    },
    {
        "key": "health_cases",
        "label": "Casos sanitarios",
        "method": "GET",
        "path": "/health-cases",
        "description": "Casos abiertos/cerrados por animal, corral, enfermedad, gravedad o fecha.",
    },
    {
        "key": "treatments",
        "label": "Tratamientos",
        "method": "GET",
        "path": "/treatments",
        "description": "Tratamientos veterinarios por caso, animal o corral.",
    },
    {
        "key": "vaccinations",
        "label": "Vacunaciones",
        "method": "GET",
        "path": "/vaccinations",
        "description": "Vacunas aplicadas y revacunaciones previstas por animal, corral o unidad REGA.",
    },
    {
        "key": "dewormings",
        "label": "Desparasitaciones",
        "method": "GET",
        "path": "/dewormings",
        "description": "Desparasitaciones internas/externas por animal, corral o unidad REGA.",
    },
    {
        "key": "reproductive_events",
        "label": "Eventos reproductivos",
        "method": "GET",
        "path": "/reproductive-events",
        "description": "Celos, cubriciones, ecografias, gestaciones, partos, abortos y cambios de estado.",
    },
    {
        "key": "reminders",
        "label": "Recordatorios",
        "method": "GET",
        "path": "/reminders",
        "description": "Avisos pendientes, pospuestos, completados o vencidos.",
    },
    {
        "key": "exports",
        "label": "Exportaciones CSV",
        "method": "GET",
        "path": "/exports/animals | /exports/health-cases | /exports/movements | /exports/reminders",
        "description": "Descarga CSV de censos, sanidad, movimientos y avisos.",
    },
]


ACTION_ENDPOINTS = {
    "change_pen": {
        "label": "Cambio de corral o lote",
        "method": "POST",
        "path": "/movements",
        "required": ["tipoOperacion", "unidadRegaId", "corralDestinoId", "crotales[]"],
        "optional": ["fecha", "motivo"],
        "notes": "Ejecuta el movimiento y actualiza el corral actual de cada animal encontrado.",
    },
    "create_animal": {
        "label": "Alta de animal",
        "method": "POST",
        "path": "/animals",
        "required": ["crotal", "sexo", "unidadRegaId", "especieId"],
        "optional": [
            "numeroInterno", "fechaNacimiento", "fechaEntrada", "origen",
            "estadoRegistro", "razaId", "corralActualId", "estadoReproductivoId",
            "madreId", "padreId", "observaciones",
        ],
        "notes": "Da de alta un animal nuevo. Debe confirmarse para evitar duplicados o crotales mal leidos.",
    },
    "update_animal": {
        "label": "Modificar ficha de animal",
        "method": "PUT",
        "path": "/animals/:id",
        "required": ["animalId o crotal localizado", "campo a modificar"],
        "optional": [
            "crotal", "numeroInterno", "sexo", "fechaNacimiento", "fechaEntrada",
            "origen", "estadoRegistro", "fechaSalida", "destinoSalida",
            "unidadRegaId", "especieId", "razaId", "corralActualId",
            "estadoReproductivoId", "madreId", "padreId", "observaciones",
        ],
        "notes": "Actualiza datos administrativos de un animal concreto.",
    },
    "animal_discharge": {
        "label": "Baja de animal",
        "method": "PUT",
        "path": "/animals/:id",
        "required": ["animalId o crotal localizado", "estadoRegistro=BAJA"],
        "optional": ["fechaSalida", "destinoSalida", "observaciones"],
        "notes": "La app no borra animales: marca la salida/baja conservando historial.",
    },
    "birth": {
        "label": "Parto / nacimiento",
        "method": "UI",
        "path": "/birth/new/:motherId",
        "required": ["madre localizada por lector"],
        "optional": ["numero de crias", "sexo", "padre"],
        "notes": "Abre el formulario de parto tras leer la madre; no registra nada desde el chat.",
    },
    "create_pen": {
        "label": "Alta de corral",
        "method": "POST",
        "path": "/pens",
        "required": ["nombre", "unidadRegaId"],
        "optional": ["tipoFuncional", "capacidad", "estadoReproductivoSugeridoId", "aplicarEstadoAutomaticamente"],
        "notes": "Crea un corral dentro de una unidad REGA.",
    },
    "update_pen": {
        "label": "Modificar corral",
        "method": "PUT",
        "path": "/pens/:id",
        "required": ["corralId", "campo a modificar"],
        "optional": ["nombre", "tipoFuncional", "capacidad", "unidadRegaId", "estadoReproductivoSugeridoId", "aplicarEstadoAutomaticamente"],
        "notes": "Cambia datos de un corral existente.",
    },
    "create_farm_unit": {
        "label": "Alta de unidad REGA",
        "method": "POST",
        "path": "/farm-units",
        "required": ["nombre"],
        "optional": ["codigoRega", "direccion", "municipio", "provincia", "activa"],
        "notes": "Crea una nueva unidad REGA de la cuenta ganadera.",
    },
    "update_farm_unit": {
        "label": "Modificar unidad REGA",
        "method": "PUT",
        "path": "/farm-units/:id",
        "required": ["unidadRegaId", "campo a modificar"],
        "optional": ["nombre", "codigoRega", "direccion", "municipio", "provincia", "activa"],
        "notes": "Actualiza datos de una unidad REGA.",
    },
    "create_health_case": {
        "label": "Abrir caso sanitario",
        "method": "POST",
        "path": "/health-cases",
        "required": ["fechaInicio", "unidadRegaId"],
        "optional": [
            "animalId", "corralId", "enfermedadId", "signosClinicos",
            "diagnosticoPresuntivo", "diagnosticoConfirmado", "gravedad",
            "afectaBienestar", "lazareto", "avisoDeclaracionMostrado",
            "estado", "fechaCierre", "resultado",
        ],
        "notes": "Registra una incidencia sanitaria de animal, corral o lote.",
    },
    "update_health_case": {
        "label": "Actualizar caso sanitario",
        "method": "PUT",
        "path": "/health-cases/:id",
        "required": ["casoSanitarioId", "campo a modificar"],
        "optional": [
            "signosClinicos", "diagnosticoPresuntivo", "diagnosticoConfirmado",
            "gravedad", "afectaBienestar", "lazareto", "estado",
            "fechaCierre", "resultado", "animalId", "corralId", "enfermedadId",
        ],
        "notes": "Modifica o cierra un caso sanitario existente.",
    },
    "create_treatment": {
        "label": "Registrar tratamiento",
        "method": "POST",
        "path": "/treatments",
        "required": ["fechaInicio", "medicamentoProducto", "casoSanitarioId o animalId o corralId"],
        "optional": [
            "fechaFin", "motivo", "principioActivo", "dosisTexto",
            "unidad", "via", "frecuencia", "duracionDias", "retirada", "documentoUrl",
        ],
        "notes": "Registra medicacion; no decide tratamientos por su cuenta.",
    },
    "update_treatment": {
        "label": "Actualizar tratamiento",
        "method": "PUT",
        "path": "/treatments/:id",
        "required": ["tratamientoId", "campo a modificar"],
        "optional": [
            "fechaInicio", "fechaFin", "motivo", "medicamentoProducto",
            "principioActivo", "dosisTexto", "unidad", "via", "frecuencia",
            "duracionDias", "retirada", "documentoUrl", "casoSanitarioId",
            "animalId", "corralId",
        ],
        "notes": "Actualiza una ficha de tratamiento.",
    },
    "create_vaccination": {
        "label": "Registrar vacunacion",
        "method": "POST",
        "path": "/vaccinations",
        "required": ["fecha", "vacuna", "unidadRegaId", "animalId o corralId"],
        "optional": ["loteVacuna", "dosisTexto", "via", "revacunacionPrevista", "fechaRevacunacion", "reaccion", "documentoUrl"],
        "notes": "Registra una vacuna aplicada a animal o corral/lote.",
    },
    "update_vaccination": {
        "label": "Actualizar vacunacion",
        "method": "PUT",
        "path": "/vaccinations/:id",
        "required": ["vacunacionId", "campo a modificar"],
        "optional": ["fecha", "vacuna", "loteVacuna", "dosisTexto", "via", "revacunacionPrevista", "fechaRevacunacion", "reaccion", "documentoUrl", "animalId", "corralId"],
        "notes": "Actualiza una vacunacion registrada.",
    },
    "create_deworming": {
        "label": "Registrar desparasitacion",
        "method": "POST",
        "path": "/dewormings",
        "required": ["fecha", "tipo", "producto", "unidadRegaId", "animalId o corralId"],
        "optional": ["principioActivo", "dosisTexto", "via", "motivo", "proximaDosisPrevista", "fechaProximaDosis", "reaccion", "documentoUrl"],
        "notes": "Registra desparasitacion interna o externa.",
    },
    "update_deworming": {
        "label": "Actualizar desparasitacion",
        "method": "PUT",
        "path": "/dewormings/:id",
        "required": ["desparasitacionId", "campo a modificar"],
        "optional": ["fecha", "tipo", "producto", "principioActivo", "dosisTexto", "via", "motivo", "proximaDosisPrevista", "fechaProximaDosis", "reaccion", "documentoUrl", "animalId", "corralId"],
        "notes": "Actualiza una desparasitacion registrada.",
    },
    "create_reproductive_event": {
        "label": "Registrar evento reproductivo o estado gestacional",
        "method": "POST",
        "path": "/reproductive-events",
        "required": ["tipoEvento", "fecha", "animalId"],
        "optional": ["resultado", "semanasGestacion", "fechaPartoEstimada", "numeroCriasVivas", "numeroCriasMuertas", "observaciones", "estadoResultanteId"],
        "notes": "Registra celo, cubricion, diagnostico de gestacion, parto, aborto o cambio de estado.",
    },
    "update_reproductive_event": {
        "label": "Actualizar evento reproductivo",
        "method": "PUT",
        "path": "/reproductive-events/:id",
        "required": ["eventoReproductivoId", "campo a modificar"],
        "optional": ["tipoEvento", "resultado", "fecha", "semanasGestacion", "fechaPartoEstimada", "numeroCriasVivas", "numeroCriasMuertas", "observaciones", "animalId", "estadoResultanteId"],
        "notes": "Actualiza un evento reproductivo y, si procede, el estado reproductivo del animal.",
    },
    "create_reminder": {
        "label": "Crear aviso o recordatorio",
        "method": "POST",
        "path": "/reminders",
        "required": ["tipo", "fechaObjetivo"],
        "optional": ["estado", "pospuestoHasta", "origenRegla", "nota", "animalId", "corralId"],
        "notes": "Crea un aviso manual asociado a la cuenta, animal o corral.",
    },
    "update_reminder": {
        "label": "Actualizar aviso",
        "method": "PUT",
        "path": "/reminders/:id",
        "required": ["recordatorioId", "campo a modificar"],
        "optional": ["tipo", "fechaObjetivo", "estado", "pospuestoHasta", "origenRegla", "nota", "animalId", "corralId"],
        "notes": "Actualiza un recordatorio.",
    },
    "complete_reminder": {
        "label": "Completar aviso",
        "method": "PUT",
        "path": "/reminders/:id/complete",
        "required": ["recordatorioId"],
        "optional": [],
        "notes": "Marca un aviso como completado.",
    },
    "snooze_reminder": {
        "label": "Posponer aviso",
        "method": "PUT",
        "path": "/reminders/:id/snooze",
        "required": ["recordatorioId", "days"],
        "optional": [],
        "notes": "Pospone un aviso el numero de dias indicado.",
    },
    "send_export_request": {
        "label": "Enviar solicitud de exportacion",
        "method": "POST",
        "path": "/exports/send-request",
        "required": ["tipoExportacion", "fechaDesde", "fechaHasta", "emailDestino"],
        "optional": ["unidadRegaId"],
        "notes": "Registra una solicitud de exportacion CENSO o VETERINARIO y la envia a n8n si esta configurado.",
    },
}


def _data_items(data):
    if isinstance(data, dict):
        if isinstance(data.get("data"), list):
            return data.get("data")
        return []
    if isinstance(data, list):
        return data
    return []


def _field(obj, *names, default=None):
    for name in names:
        if not isinstance(obj, dict):
            return default
        value = obj.get(name)
        if value not in (None, ""):
            return value
    return default


def _nested_name(obj, key: str, fallback: str | None = "N/D") -> str | None:
    value = obj.get(key) if isinstance(obj, dict) else None

    if isinstance(value, dict):
        return (
            value.get("nombre")
            or value.get("crotal")
            or value.get("codigoRega")
            or fallback
        )

    return fallback


def _animal_query_from_message(message):
    normalized = _normalize(message)

    explicit_search_words = [
        "busca", "buscar", "encuentra", "localiza", "ficha",
        "crotal", "rfid", "lector", "lectura", "identificador", "id animal",
    ]

    has_search_intent = any(word in normalized for word in explicit_search_words)
    tokens = re.findall(r"\b(?:es[-_]?)?[a-z]{0,4}\d[a-z0-9_/-]{2,}\b", normalized)

    if has_search_intent and tokens:
        return tokens[0]

    match = re.search(
        r"(?:crotal|rfid|lector|lectura|identificador|id animal)\s+([a-z0-9_/-]*\d[a-z0-9_/-]*)",
        normalized,
    )
    if match:
        return match.group(1)

    return None


def _ear_tags_from_message(message):
    tokens = re.findall(
        r"\b(?:es[-_]?)?[a-z]{0,12}\d[a-z0-9_/-]{2,}\b",
        message or "",
        flags=re.IGNORECASE,
    )
    return [token.upper() for token in tokens]


def _relative_date_from_message(normalized):
    if "hoy" in normalized:
        return "hoy"
    if "ayer" in normalized:
        return "ayer"
    if "manana" in normalized:
        return "manana"

    match = re.search(r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b", normalized)
    return match.group(0) if match else None


MOVEMENT_PLACE_ALIASES = [
    ("secado", "secado"),
    ("secas", "secado"),
    ("seca", "secado"),
    ("cebo", "cebo"),
    ("produccion", "produccion"),
    ("productoras", "produccion"),
    ("lactacion", "lactacion"),
    ("lactancia", "lactancia"),
    ("ordeno", "produccion"),
    ("paridas", "paridas"),
    ("parida", "paridas"),
    ("paridera", "paridas"),
    ("gestantes", "gestantes"),
    ("gestante", "gestantes"),
    ("prenadas", "gestantes"),
    ("prenada", "gestantes"),
    ("reposicion", "reposicion"),
    ("recria", "reposicion"),
    ("lazareto", "lazareto"),
    ("enfermeria", "lazareto"),
]


def _known_movement_place_pattern():
    return "|".join(re.escape(term) for term, _label in MOVEMENT_PLACE_ALIASES)


def _has_origin_destination_movement(normalized):
    places = _known_movement_place_pattern()
    return re.search(rf"\b(?:de|desde)\s+(?:el\s+)?(?:corral\s+|lote\s+)?(?:{places})\s+(?:a|al|hacia|para)\s+(?:el\s+)?(?:corral\s+|lote\s+)?(?:{places})\b", normalized) is not None


def _movement_destination_from_message(normalized):
    places = _known_movement_place_pattern()
    origin_destination = re.search(
        rf"\b(?:de|desde)\s+(?:el\s+)?(?:corral\s+|lote\s+)?(?:{places})\s+(?:a|al|hacia|para)\s+(?:el\s+)?(?:corral\s+|lote\s+)?(?P<dest>{places})\b",
        normalized,
    )
    if origin_destination:
        destination = origin_destination.group("dest")
        for term, label in MOVEMENT_PLACE_ALIASES:
            if term == destination:
                return label
        return destination

    aliases = MOVEMENT_PLACE_ALIASES
    for term, label in aliases:
        if term in normalized:
            return label

    match = re.search(
        r"\b(?:al|a la|a|hacia|para)\s+(?:corral|lote)?\s*([a-z0-9 _/-]{2,40})",
        normalized,
    )
    if not match:
        return None

    candidate = match.group(1).strip(" .,:;")
    stop = re.search(r"\b(?:hoy|ayer|porque|por|con|y|pero|confirmo)\b", candidate)
    if stop:
        candidate = candidate[:stop.start()].strip(" .,:;")
    return candidate or None


NUMBER_WORDS = {
    "un": 1,
    "una": 1,
    "uno": 1,
    "dos": 2,
    "tres": 3,
    "cuatro": 4,
    "cinco": 5,
    "seis": 6,
    "siete": 7,
    "ocho": 8,
    "nueve": 9,
    "diez": 10,
}


SPECIES_ALIASES = [
    ("cabras", "cabras"),
    ("cabra", "cabras"),
    ("caprino", "cabras"),
    ("caprinas", "cabras"),
    ("ovejas", "ovejas"),
    ("oveja", "ovejas"),
    ("ovino", "ovejas"),
    ("ovinas", "ovejas"),
    ("corderos", "corderos"),
    ("cordero", "corderos"),
    ("cabritos", "cabritos"),
    ("cabrito", "cabritos"),
    ("vacas", "vacas"),
    ("vaca", "vacas"),
    ("vacuno", "vacas"),
    ("terneros", "terneros"),
    ("ternero", "terneros"),
    ("cerdos", "cerdos"),
    ("cerdo", "cerdos"),
    ("porcino", "cerdos"),
    ("caballos", "caballos"),
    ("caballo", "caballos"),
    ("equino", "caballos"),
]


def _expected_count_from_message(normalized):
    match = re.search(r"\b(\d{1,3})\s+(?:animales?|cabras?|ovejas?|corderos?|cabritos?|vacas?|terneros?|cerdos?|caballos?)\b", normalized)
    if match:
        return int(match.group(1))

    for word, value in NUMBER_WORDS.items():
        if re.search(rf"\b{word}\s+(?:animales?|cabras?|ovejas?|corderos?|cabritos?|vacas?|terneros?|cerdos?|caballos?)\b", normalized):
            return value

    return None


def _expected_species_from_message(normalized):
    for term, label in SPECIES_ALIASES:
        if re.search(rf"\b{re.escape(term)}\b", normalized):
            return label
    return None


def _weeks_from_message(normalized):
    match = re.search(r"\b(\d{1,2})\s*(?:semanas?|sem)\b", normalized)
    if match:
        return int(match.group(1))
    return None


def _text_after_any(normalized, markers):
    for marker in markers:
        index = normalized.find(marker)
        if index >= 0:
            text = normalized[index + len(marker):].strip(" .,:;-")
            text = re.split(r"\b(?:para|con|en|a|al|hoy|ayer|manana|y|pero)\b", text, maxsplit=1)[0]
            return text.strip(" .,:;-") or None
    return None


def _has_birth_intent(normalized):
    if re.search(r"\b(?:nacer|nacio|nacieron|nacido|nacidos|nacida|nacidas)\b", normalized):
        return True

    return any(term in normalized for term in [
        "acaba de parir", "acabo de parir", "ha parido", "pario",
        "ha pario", "a parido", "parida", "recien parida", "parto", "parir", "parido",
        "ha tenido cria", "ha tenido crias", "nacimiento",
        "cria nueva", "crias nuevas", "acaba de nacer", "acaban de nacer"
    ])


def _has_death_intent(normalized):
    return any(term in normalized for term in [
        "se ha muerto", "se murio", "ha muerto", "esta muerto", "esta muerta",
        "muerto", "muerta", "fallecio", "fallecida", "fallecido",
        "murio", "muerte", "dar de baja", "baja animal", "baja un animal",
    ])


def _is_watchlist_request(normalized):
    return any(term in normalized for term in [
        "busqueda inteligente", "busqueda viva", "watchlist", "lista de busqueda",
        "abre la lista", "buscar la lista", "animales marcados"
    ])


def _discharge_reason_from_message(normalized):
    if any(term in normalized for term in ["muerte", "muerto", "muerta", "murio", "murio", "fallecio", "fallecida", "fallecido"]):
        return "muerte"
    if any(term in normalized for term in ["venta", "vendido", "vendida", "vender"]):
        return "venta"
    if any(term in normalized for term in ["sacrificio", "matadero", "sacrificado", "sacrificada"]):
        return "sacrificio"
    if any(term in normalized for term in ["traslado", "salida", "otro rega", "otra explotacion"]):
        return "traslado"
    return None


def _discharge_notes_from_message(normalized):
    no_cause_terms = [
        "sin causa", "sin mas causa", "sin mas causas", "no hay causa",
        "no hay mas causa", "no hay mas causas", "ninguna causa",
        "no se sabe", "no hay detalles", "sin detalles"
    ]
    if any(term in normalized for term in no_cause_terms):
        return "sin causa adicional"
    return None


def _friendly_missing_list(items):
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " y " + items[-1]


def _prepare_change_pen_summary(message, endpoint):
    normalized = _normalize(message)
    ear_tags = _ear_tags_from_message(message)
    destination = _movement_destination_from_message(normalized)
    when = _relative_date_from_message(normalized)

    missing = []
    if not ear_tags:
        missing.append("el crotal o la lectura RFID")
    if not destination:
        missing.append("el corral o lote destino")

    lines = []
    if not missing:
        lines.append("Tengo preparado el movimiento, pero no lo ejecuto hasta que confirmes.")
    else:
        lines.append("Puedo preparar el movimiento, pero falta " + _friendly_missing_list(missing) + ".")

    if ear_tags:
        label = "Animal" if len(ear_tags) == 1 else "Animales"
        lines.append(f"{label}: {', '.join(ear_tags)}.")
    if destination:
        lines.append(f"Destino solicitado: {destination}.")
    if when:
        lines.append(f"Fecha indicada: {when}.")

    if not missing:
        lines.append("Confirma con algo como: confirmo moverlo.")
    else:
        lines.append("Cuando me lo des, te preparo el resumen final para confirmar.")

    return "\n".join(lines), {
        "crotales": ear_tags,
        "destino_solicitado": destination,
        "fecha": when,
        "missing": missing,
        "technical_contract": endpoint,
    }


def _prepare_discharge_summary(message, endpoint):
    normalized = _normalize(message)
    ear_tags = _ear_tags_from_message(message)
    reason = _discharge_reason_from_message(normalized)
    when = _relative_date_from_message(normalized)
    notes = _discharge_notes_from_message(normalized)

    missing = []
    if not ear_tags:
        missing.append("el crotal")
    if not reason:
        missing.append("el motivo de baja")
    if not when:
        missing.append("la fecha")

    if not ear_tags:
        summary = (
            "Puedo preparar la baja, pero necesito el crotal exacto del animal. "
            "Despues te pedire motivo y fecha antes de confirmar."
        )
    elif missing:
        summary = (
            f"Para preparar la baja de {ear_tags[0]} necesito "
            f"{_friendly_missing_list([item for item in missing if item != 'el crotal'])}. "
            "No la registro sin confirmacion final."
        )
    else:
        note_text = f" Observaciones: {notes}." if notes else ""
        summary = (
            f"Tengo preparada la baja de {ear_tags[0]} por {reason}, con fecha {when}."
            f"{note_text}\nConfirma si quieres registrarla."
        )

    return summary, {
        "crotales": ear_tags,
        "motivo": reason,
        "fecha": when,
        "observaciones": notes,
        "missing": missing,
        "technical_contract": endpoint,
    }


def _prepare_generic_action_summary(action_key, endpoint):
    required = ", ".join(endpoint["required"])
    optional = ", ".join(endpoint["optional"]) if endpoint["optional"] else "sin opcionales"
    return (
        f"Puedo preparar {endpoint['label'].lower()}, pero antes necesito los datos concretos "
        "y una confirmacion final.\n"
        f"Datos que faltan o debo validar: {required}.\n"
        f"Opcionales: {optional}."
    ), {
        "missing": endpoint["required"],
        "technical_contract": endpoint,
    }


READER_ACTION_DRAFTS = {
    "create_health_case": {
        "summary": (
            "Puedo abrir un caso sanitario como borrador.\n"
            "Pasa el lector para identificar animal(es) o usa la pestana Corral si afecta a un corral completo. "
            "Despues necesito fecha, signos principales y gravedad. No registro nada sin confirmacion final."
        ),
        "missing": ["lectura RFID/crotal o corral", "fecha", "signos principales"],
        "preferred_mode": "lote",
    },
    "create_treatment": {
        "summary": (
            "Puedo preparar un tratamiento como borrador.\n"
            "Pasa el lector para identificar animal(es) o usa Corral si se aplico al corral completo. "
            "Despues necesito medicamento/producto, fecha y dosis si la tienes. No decido medicacion por mi cuenta."
        ),
        "missing": ["lectura RFID/crotal o corral", "medicamento/producto", "fecha"],
        "preferred_mode": "lote",
    },
    "create_vaccination": {
        "summary": (
            "Puedo preparar una vacunacion como borrador.\n"
            "Pasa el lector para animales sueltos/lote o usa Corral para corral completo. "
            "Despues necesito nombre de vacuna, fecha y lote de vacuna si lo tienes. No registro nada sin confirmacion final."
        ),
        "missing": ["lectura RFID/crotal o corral", "vacuna", "fecha"],
        "preferred_mode": "corral",
    },
    "create_deworming": {
        "summary": (
            "Puedo preparar una desparasitacion como borrador.\n"
            "Pasa el lector para animales sueltos/lote o usa Corral para corral completo. "
            "Despues necesito producto, tipo si es interno/externo y fecha. No registro nada sin confirmacion final."
        ),
        "missing": ["lectura RFID/crotal o corral", "producto", "fecha"],
        "preferred_mode": "corral",
    },
    "create_reproductive_event": {
        "summary": (
            "Puedo preparar un evento reproductivo o estado gestacional como borrador.\n"
            "Pasa el lector del animal. Despues necesito si es celo, cubricion, ecografia, gestacion, parto o aborto, "
            "y la fecha. No registro nada sin confirmacion final."
        ),
        "missing": ["lectura RFID/crotal", "tipo de evento", "fecha"],
        "preferred_mode": "unitario",
    },
}


def _prepare_reader_action_summary(action_key, endpoint, message):
    config = READER_ACTION_DRAFTS[action_key]
    normalized = _normalize(message)
    ear_tags = _ear_tags_from_message(message)
    when = _relative_date_from_message(normalized)
    preferred_mode = config["preferred_mode"]

    if any(term in normalized for term in ["corral completo", "todo el corral", "por corral"]):
        preferred_mode = "corral"
    elif "lote" in normalized:
        preferred_mode = "lote"
    elif len(ear_tags) == 1:
        preferred_mode = "unitario"
    elif len(ear_tags) > 1:
        preferred_mode = "lote"

    extra = []
    if ear_tags:
        extra.append(f"Lecturas detectadas: {', '.join(ear_tags)}.")
    if when:
        extra.append(f"Fecha indicada: {when}.")

    summary = config["summary"]
    if extra:
        summary += "\n" + "\n".join(extra)

    return summary, {
        "crotales": ear_tags,
        "fecha": when,
        "missing": config["missing"],
        "preferred_mode": preferred_mode,
        "technical_contract": endpoint,
    }


def _health_type_for_action(action_key):
    if action_key == "create_vaccination":
        return "vaccination"
    if action_key == "create_deworming":
        return "deworming"
    if action_key == "create_health_case":
        return "disease"
    return "other"


def _build_health_draft(action_key, normalized):
    health_type = _health_type_for_action(action_key)
    draft = {
        "operationType": "health",
        "healthType": health_type,
        "expectedCount": _expected_count_from_message(normalized),
        "expectedSpecies": _expected_species_from_message(normalized),
        "fullPen": any(term in normalized for term in ["corral completo", "todo el corral", "todo un corral", "todo corral", "por corral"]),
    }

    if health_type == "vaccination":
        match = re.search(r"\bvacun\w*\s+(?:estas?|estos?|el lote|lote)?\s*(?:de|contra)\s+([a-z0-9 _/-]{2,50})", normalized)
        text = match.group(1).strip(" .,:;-") if match else _text_after_any(normalized, ["vacuna de", "vacunar de", "vacuna contra", "vacunar contra", "vacuna"])
        if text:
            draft["vacunaTexto"] = text
    elif health_type == "deworming":
        match = re.search(r"\bdesparasit\w*\s+(?:estas?|estos?|el lote|lote)?\s*(?:con|de)?\s*([a-z0-9 _/-]{2,50})", normalized)
        text = match.group(1).strip(" .,:;-") if match else _text_after_any(normalized, ["desparasita con", "desparasitar con", "desparasita", "desparasitar"])
        if text in {"el lote", "lote", "estas", "estos", "esta", "este"}:
            text = None
        if text:
            draft["desparasitanteTexto"] = text
    elif health_type == "disease":
        text = _text_after_any(normalized, ["enfermedad de", "caso de", "diagnostico de", "abrir caso de"])
        if text:
            draft["enfermedadTexto"] = text
    else:
        text = _text_after_any(normalized, ["tratamiento con", "tratar con", "medicar con"])
        if text:
            draft["otroSanitarioTexto"] = text

    return draft


def _build_reproductive_draft(normalized):
    draft = {
        "operationType": "reproductive",
        "expectedCount": _expected_count_from_message(normalized),
        "expectedSpecies": _expected_species_from_message(normalized),
    }

    weeks = _weeks_from_message(normalized)
    if weeks:
        draft["semanasGestacion"] = str(weeks)

    if any(term in normalized for term in ["gestante", "gestantes", "prenada", "prenadas", "preñada", "preñadas", "gestacion positiva"]):
        draft.update({
            "tipoEvento": "DIAGNOSTICO_GESTACION",
            "resultado": "POSITIVO",
            "estadoResultanteAlias": "gestante",
        })
    elif any(term in normalized for term in ["diagnostico", "ecografia", "eco"]):
        draft.update({
            "tipoEvento": "DIAGNOSTICO_GESTACION",
            "resultado": "POSITIVO" if any(term in normalized for term in ["positivo", "prenada", "preñada", "gestante"]) else "NO_APLICA",
        })
    elif "aborto" in normalized:
        draft.update({"tipoEvento": "ABORTO", "resultado": "NO_APLICA"})
    elif any(term in normalized for term in ["secado", "seca", "secar"]):
        draft.update({"tipoEvento": "SECADO", "estadoResultanteAlias": "seca"})
    elif any(term in normalized for term in ["cubricion", "cubrir", "cubri", "cubierto", "cubierta", "cubiertas", "echar macho"]):
        draft.update({"tipoEvento": "CUBRICION"})
    elif any(term in normalized for term in ["inseminacion", "inseminar", "inseminado", "inseminada", "insemine"]):
        draft.update({"tipoEvento": "INSEMINACION"})
    elif any(term in normalized for term in ["parto", "parido", "parida"]):
        draft.update({"tipoEvento": "PARTO"})

    return draft


def _ui_action_for_action(action_key, message, draft):
    normalized = _normalize(message)
    ear_tags = _ear_tags_from_message(message)

    if action_key == "change_pen":
        destination = draft.get("destino_solicitado") or _movement_destination_from_message(normalized)
        operation_draft = {
            "operationType": "movement",
            "targetPenName": destination,
            "corralDestinoAlias": destination,
            "motivo": "Preparado desde el chat IA",
            "expectedCount": _expected_count_from_message(normalized),
            "expectedSpecies": _expected_species_from_message(normalized),
            "crotales": ear_tags,
        }
        return {
            "kind": "operation_flow",
            "operationType": "movement",
            "route": "/operations/movement",
            "draft": operation_draft,
        }

    if action_key in {"create_health_case", "create_treatment", "create_vaccination", "create_deworming"}:
        operation_draft = _build_health_draft(action_key, normalized)
        operation_draft["crotales"] = ear_tags
        return {
            "kind": "operation_flow",
            "operationType": "health",
            "route": "/operations/health",
            "draft": operation_draft,
        }

    if action_key == "create_reproductive_event":
        operation_draft = _build_reproductive_draft(normalized)
        operation_draft["crotales"] = ear_tags
        return {
            "kind": "operation_flow",
            "operationType": "reproductive",
            "route": "/operations/reproductive",
            "draft": operation_draft,
        }

    if action_key == "animal_discharge":
        return {
            "kind": "silent_reader",
            "action": "baja",
            "route": "/animals/:id/discharge",
            "crotales": ear_tags,
            "draft": {
                "motivo": draft.get("motivo") or _discharge_reason_from_message(normalized) or "Muerte",
                "fecha": draft.get("fecha") or "hoy",
                "observaciones": draft.get("observaciones") or "",
            },
        }

    if action_key == "birth":
        return {
            "kind": "silent_reader",
            "action": "parto",
            "route": "/birth/new/:motherId",
            "crotales": ear_tags,
            "draft": {
                "expectedSpecies": _expected_species_from_message(normalized),
            },
        }

    if action_key == "create_reminder":
        return {
            "kind": "manual_reminder",
            "route": "/reminders",
            "draft": {
                "text": message,
                "crotales": ear_tags,
            },
        }

    return None


def _prepared_ui_summary(action_key, ui_action, fallback_summary):
    if not ui_action:
        return fallback_summary

    if ui_action["kind"] == "operation_flow":
        labels = {
            "movement": "movimiento de corral",
            "reproductive": "estado reproductivo",
            "health": "evento sanitario",
        }
        operation = ui_action.get("operationType")
        draft = ui_action.get("draft") or {}
        bits = [f"He preparado el flujo de {labels.get(operation, 'trabajo')}."]
        if draft.get("targetPenName"):
            bits.append(f"Destino: {draft['targetPenName']}.")
        if draft.get("expectedCount") and draft.get("expectedSpecies"):
            bits.append(f"Objetivo orientativo: {draft['expectedCount']} {draft['expectedSpecies']}.")
        elif draft.get("expectedCount"):
            bits.append(f"Objetivo orientativo: {draft['expectedCount']} animales.")
        bits.append("Se abrira la pantalla para pasar el lector, revisar la lista y pulsar Finalizar.")
        return " ".join(bits)

    if ui_action["kind"] == "silent_reader":
        action = ui_action.get("action")
        if action == "parto":
            return "Activo el lector para localizar la madre y abrir el formulario de parto."
        if action == "baja":
            return "Activo el lector para localizar el animal y abrir la pantalla de baja."
        return "Activo el lector para abrir la ficha del animal."

    if ui_action["kind"] == "open_route":
        return "Abro esa pantalla en la app para que puedas continuar."

    if ui_action["kind"] == "manual_reminder":
        return "Preparo la pantalla de avisos para crear la alerta manual con ese motivo."

    return fallback_summary


def _looks_like_advice_not_action(normalized):
    advice_terms = [
        "que vacuna", "que tratamiento", "que medicamento", "que antibiotico",
        "que le doy", "que le pongo", "como trato", "como medico",
        "puedo darle", "puedo ponerle", "debo darle", "debo ponerle"
    ]
    return any(term in normalized for term in advice_terms)


def _has_movement_intent(normalized):
    if any(phrase in normalized for phrase in ["pasa algo", "que pasa si", "puede pasar algo"]):
        return False

    if _has_origin_destination_movement(normalized):
        return True

    action_words = [
        "mover", "mueve", "movimiento", "trasladar", "traslada",
        "pasar", "pasa", "meter", "mete", "apartar", "aparta",
        "cambiar", "cambia", "cambias", "cambiamos",
        "cambio de corral", "cambiar de corral", "cambiar de sitio",
        "cambia de sitio", "cambias de sitio", "cambio de sitio",
    ]
    context_words = [
        "corral", "lote", "crotales", "rfid", "lector", "paridas",
        "gestantes", "secado", "lazareto", "reposicion", "cebo",
        "oveja", "ovejas", "cabra", "cabras", "cordero", "corderos",
        "cabrito", "cabritos", "ganado", "rebano", "sitio",
    ]

    return any(word in normalized for word in action_words) and any(word in normalized for word in context_words)


def _wants_endpoint_catalog(normalized):
    return any(
        term in normalized
        for term in [
            "que endpoints", "endpoints", "rutas", "tools", "herramientas",
            "que puedes hacer", "acciones disponibles", "funciones disponibles",
            "que puede hacer la ia", "que puede hacer el gestor",
        ]
    )


def _has_create_or_update_word(normalized):
    return any(
        term in normalized
        for term in [
            "crear", "crea", "registrar", "registra", "guardar", "guarda",
            "anadir", "anade", "añadir", "añade", "alta", "dar de alta",
            "baja", "dar de baja", "da de baja",
            "nuevo", "nueva", "actualizar", "actualiza", "modificar", "modifica",
            "cambiar", "cambia", "cerrar", "cierra", "completar", "completa",
            "abrir", "abre", "posponer", "pospone", "exportar", "exporta",
            "enviar", "envia", "poner", "pon", "aplicar", "aplica",
            "vacunar", "vacuna este", "vacuna esta", "vacuna estos", "vacuna estas",
            "vacune", "he vacunado", "medicar", "medica", "he medicado",
            "tratar", "trata", "he tratado", "desparasitar", "desparasita",
            "he desparasitado", "inseminar", "inseminado", "he inseminado",
            "insemine", "cubrir", "cubri", "he cubierto", "echar macho",
        ]
    )


def _action_key_from_message(normalized):
    if _looks_like_advice_not_action(normalized):
        return None

    if _has_death_intent(normalized):
        return "animal_discharge"

    if _has_birth_intent(normalized):
        return "birth"

    if not _has_create_or_update_word(normalized) and not _has_movement_intent(normalized):
        return None

    if _has_movement_intent(normalized):
        return "change_pen"

    if any(term in normalized for term in ["completa aviso", "completar aviso", "marca aviso", "completa recordatorio", "completar recordatorio"]):
        return "complete_reminder"

    if any(term in normalized for term in ["pospone aviso", "posponer aviso", "pospone recordatorio", "posponer recordatorio", "aplaza aviso"]):
        return "snooze_reminder"

    if any(term in normalized for term in ["export", "censo", "informe veterinario", "enviar informe"]):
        return "send_export_request"

    if any(term in normalized for term in ["baja", "dar de baja", "fecha salida", "salida"]):
        return "animal_discharge"

    if any(term in normalized for term in ["tratamiento", "medicamento", "medicacion", "retirada", "medicar", "medica", "tratar", "trata", "he medicado", "he tratado"]):
        return "update_treatment" if any(term in normalized for term in ["actualiza", "modifica", "cambia", "cerrar"]) else "create_treatment"

    if any(term in normalized for term in ["vacuna", "vacunacion", "revacunacion", "vacunar", "vacune", "he vacunado"]):
        return "update_vaccination" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_vaccination"

    if any(term in normalized for term in ["desparasit", "antiparasitario", "parasitos"]):
        return "update_deworming" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_deworming"

    if any(term in normalized for term in ["caso sanitario", "incidencia sanitaria", "enfermedad", "diagnostico", "diagnostico"]):
        return "update_health_case" if any(term in normalized for term in ["actualiza", "modifica", "cierra", "cerrar"]) else "create_health_case"

    if any(term in normalized for term in [
        "gestacion", "gestacional", "gestante", "gestantes",
        "reproductivo", "reproductiva", "celo", "cubricion",
        "cubrir", "cubri", "cubierto", "echar macho",
        "inseminacion", "inseminar", "inseminado", "insemine",
        "ecografia", "parto", "aborto", "prenada", "prenadas",
        "preñada", "preñadas"
    ]):
        return "update_reproductive_event" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_reproductive_event"

    if any(term in normalized for term in ["aviso", "recordatorio"]):
        return "update_reminder" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_reminder"

    if any(term in normalized for term in ["unidad rega", "codigo rega", "numero rega", "rega"]):
        return "update_farm_unit" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_farm_unit"

    if any(term in normalized for term in ["corral", "lote"]):
        return "update_pen" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_pen"

    if "lazareto" in normalized:
        if any(term in normalized for term in ["crear", "crea", "alta", "nuevo", "nueva"]):
            return "create_pen"
        return "create_health_case"

    if any(term in normalized for term in ["animal", "oveja", "cabra", "cordero", "cabrito", "crotal", "rfid"]):
        return "update_animal" if any(term in normalized for term in ["actualiza", "modifica", "cambia"]) else "create_animal"

    return None


def _summarize_animals(data):
    animals = _data_items(data)
    if not animals:
        return "No se encontraron animales con ese criterio."

    lines = []
    for animal in animals[:8]:
        lines.append(
            " - {crotal}: {sexo}, {especie}, corral {corral}".format(
                crotal=animal.get("crotal") or "sin crotal",
                sexo=animal.get("sexo") or "sin sexo",
                especie=_nested_name(animal, "especie", "sin especie"),
                corral=_nested_name(animal, "corralActual", "sin corral"),
            )
        )

    total = data.get("total", len(animals)) if isinstance(data, dict) else len(animals)
    suffix = "\n" + "\n".join(lines) if lines else ""
    return f"Animales encontrados: {total}.{suffix}"


def _summarize_reminders(data):
    reminders = _data_items(data)
    if not reminders:
        return "No hay avisos pendientes devueltos por la API."

    lines = []
    for reminder in reminders[:8]:
        target = _nested_name(reminder, "animal", None) or _nested_name(reminder, "corral", None)
        target_text = f" - {target}" if target else ""
        lines.append(
            " - {title} ({date}){target}".format(
                title=reminder.get("titulo") or reminder.get("tipo") or "Aviso",
                date=reminder.get("fechaObjetivo") or "sin fecha",
                target=target_text,
            )
        )

    total = data.get("total", len(reminders)) if isinstance(data, dict) else len(reminders)
    return f"Avisos encontrados: {total}.\n" + "\n".join(lines)


def _find_species_count(species, names):
    for item in species:
        name = _normalize(item.get("name") or "")
        if any(term in name for term in names):
            return item.get("total", 0), item.get("name") or names[0]
    return None, None


def _format_count_list(items):
    return ", ".join(
        f"{item.get('total', 0)} {item.get('name', '').lower()}"
        for item in items
        if item.get("name")
    )


def _summarize_dashboard(data, query_text=""):
    normalized_query = _normalize(query_text)
    totals = data.get("totals") if isinstance(data, dict) else {}
    if not totals:
        return "La API no devolvio totales de dashboard."

    species = data.get("animalsBySpecies") or []
    species_summary = _format_count_list(species)
    statuses = data.get("animalsByReproductiveStatus") or []
    status_summary = _format_count_list(statuses)
    pens = data.get("animalsByPen") or []
    pen_summary = _format_count_list(pens)

    if "oveja" in normalized_query or "ovino" in normalized_query:
        total, label = _find_species_count(species, ["ovino", "oveja"])
        if total is not None:
            label_text = label or "ovino"
            return f"Tienes {total} ovejas registradas ({label_text.lower()})."

    if "cabra" in normalized_query or "caprino" in normalized_query:
        total, label = _find_species_count(species, ["caprino", "cabra"])
        if total is not None:
            label_text = label or "caprino"
            return f"Tienes {total} cabras registradas ({label_text.lower()})."
    
    if "por especie" in normalized_query or normalized_query.strip() in {"especie", "especies"}:
        return f"Por especie: {species_summary}." if species_summary else "No veo desglose por especie en el dashboard."

    if "por estado" in normalized_query or "estado reproductivo" in normalized_query or "gestacional" in normalized_query:
        return f"Por estado reproductivo: {status_summary}." if status_summary else "No veo desglose por estado reproductivo en el dashboard."

    if "por corral" in normalized_query:
        return f"Por corral: {pen_summary}." if pen_summary else "No veo desglose por corral en el dashboard."

    if "corral" in normalized_query and any(term in normalized_query for term in ["cuantos", "cuantas", "total"]):
        base = f"Tienes {totals.get('totalPens', 'N/D')} corrales registrados."
        return f"{base} Por corral: {pen_summary}." if pen_summary else base

    if any(term in normalized_query for term in ["produccion", "lactacion", "lactancia", "ordenio", "ordeno"]):
        production_items = [
            item for item in statuses
            if any(term in _normalize(item.get("name") or "") for term in ["produccion", "lactacion", "lactancia", "ordenio", "ordeno"])
        ]
        if production_items:
            total = sum(item.get("total", 0) for item in production_items)
            detail = _format_count_list(production_items)
            return f"Tienes {total} animales en estados de produccion: {detail}."

        if status_summary:
            return f"No veo un estado llamado produccion exactamente. Estados registrados: {status_summary}."

    if any(term in normalized_query for term in ["animales", "ganado", "cuantos", "cuantas", "cuanto"]):
        if species_summary:
            return (
                f"Tienes {totals.get('totalAnimals', 'N/D')} animales registrados, "
                f"{totals.get('activeAnimals', 'N/D')} activos. Por especie: {species_summary}."
            )

        return (
            f"Tienes {totals.get('totalAnimals', 'N/D')} animales registrados, "
            f"{totals.get('activeAnimals', 'N/D')} activos."
        )

    base = (
        "Resumen de explotacion: "
        f"{totals.get('totalAnimals', 'N/D')} animales totales, "
        f"{totals.get('activeAnimals', 'N/D')} activos, "
        f"{totals.get('totalPens', 'N/D')} corrales, "
        f"{totals.get('openHealthCases', totals.get('activeHealthCases', 'N/D'))} casos sanitarios activos."
    )

    if species_summary:
        return f"{base} Por especie: {species_summary}."

    return base


def _summarize_farm_units(data):
    farm_units = _data_items(data)
    if not farm_units:
        return "No hay unidades REGA devueltas por la API."

    lines = []
    for unit in farm_units:
        name = unit.get("nombre") or "Unidad REGA"
        code = unit.get("codigoRega") or "sin codigo REGA registrado"
        location = ", ".join(item for item in [unit.get("municipio"), unit.get("provincia")] if item)
        suffix = f" ({location})" if location else ""
        lines.append(f"- {name}: {code}{suffix}")

    return "Unidades REGA registradas:\n" + "\n".join(lines)


def _summarize_pens(data):
    pens = _data_items(data)
    if not pens:
        return "No hay corrales devueltos por la API."

    lines = []
    for pen in pens[:12]:
        count = (pen.get("_count") or {}).get("animalesActuales")
        capacity = pen.get("capacidad")
        count_text = f"{count} animales" if count is not None else "sin conteo"
        capacity_text = f", capacidad {capacity}" if capacity else ""
        status = _nested_name(pen, "estadoReproductivoSugerido", None)
        status_text = f", estado sugerido {status}" if status else ""
        lines.append(f"- {pen.get('nombre') or 'Corral'}: {count_text}{capacity_text}{status_text}")

    total = data.get("total", len(pens)) if isinstance(data, dict) else len(pens)
    return f"Corrales registrados: {total}.\n" + "\n".join(lines)


def _summarize_catalogs(data):
    if not isinstance(data, dict):
        return "La API no devolvio catalogos."

    labels = {
        "farmUnits": "unidades REGA",
        "species": "especies",
        "breeds": "razas",
        "reproductiveStatuses": "estados reproductivos",
        "pens": "corrales",
        "diseases": "enfermedades",
    }
    parts = []
    for key, label in labels.items():
        values = data.get(key) or []
        parts.append(f"{len(values)} {label}")

    status_names = ", ".join((item.get("nombre") or "") for item in (data.get("reproductiveStatuses") or [])[:8] if item.get("nombre"))
    disease_names = ", ".join((item.get("nombre") or "") for item in (data.get("diseases") or [])[:8] if item.get("nombre"))

    extra = []
    if status_names:
        extra.append(f"Estados: {status_names}.")
    if disease_names:
        extra.append(f"Enfermedades: {disease_names}.")

    return "Catalogos disponibles: " + ", ".join(parts) + (" " + " ".join(extra) if extra else "")


def _summarize_movements(data):
    movements = _data_items(data)
    if not movements:
        return "No hay movimientos devueltos por la API."

    lines = []
    for movement in movements[:8]:
        summary = movement.get("resumen") or {}
        processed = summary.get("procesados")
        total = summary.get("totalLeidos")
        processed_text = f", {processed}/{total} procesados" if processed is not None and total is not None else ""
        lines.append(
            "- {date}: {kind} hacia {dest}{processed}".format(
                date=movement.get("fecha") or "sin fecha",
                kind=movement.get("tipoOperacion") or "movimiento",
                dest=_nested_name(movement, "corralDestino", "sin destino"),
                processed=processed_text,
            )
        )

    total = data.get("total", len(movements)) if isinstance(data, dict) else len(movements)
    return f"Movimientos encontrados: {total}.\n" + "\n".join(lines)


def _summarize_health_cases(data):
    cases = _data_items(data)
    if not cases:
        return "No hay casos sanitarios devueltos por la API."

    lines = []
    for case in cases[:8]:
        target = _nested_name(case, "animal", None) or _nested_name(case, "corral", None) or "sin animal/corral"
        signs = case.get("signosClinicos") or case.get("diagnosticoPresuntivo") or ""
        signs_text = f" - {signs[:90]}" if signs else ""
        lines.append(f"- {case.get('fechaInicio') or 'sin fecha'}: {case.get('estado') or 'N/D'} en {target}{signs_text}")

    total = data.get("total", len(cases)) if isinstance(data, dict) else len(cases)
    return f"Casos sanitarios encontrados: {total}.\n" + "\n".join(lines)


def _summarize_treatments(data):
    treatments = _data_items(data)
    if not treatments:
        return "No hay tratamientos devueltos por la API."

    lines = []
    for treatment in treatments[:8]:
        target = _nested_name(treatment, "animal", None) or _nested_name(treatment, "corral", None) or "caso sanitario"
        lines.append(f"- {treatment.get('fechaInicio') or 'sin fecha'}: {treatment.get('medicamentoProducto') or 'tratamiento'} en {target}")

    total = data.get("total", len(treatments)) if isinstance(data, dict) else len(treatments)
    return f"Tratamientos encontrados: {total}.\n" + "\n".join(lines)


def _summarize_vaccinations(data):
    vaccinations = _data_items(data)
    if not vaccinations:
        return "No hay vacunaciones devueltas por la API."

    lines = []
    for vaccination in vaccinations[:8]:
        target = _nested_name(vaccination, "animal", None) or _nested_name(vaccination, "corral", None) or _nested_name(vaccination, "unidadRega", "sin destino")
        lines.append(f"- {vaccination.get('fecha') or 'sin fecha'}: {vaccination.get('vacuna') or 'vacuna'} en {target}")

    total = data.get("total", len(vaccinations)) if isinstance(data, dict) else len(vaccinations)
    return f"Vacunaciones encontradas: {total}.\n" + "\n".join(lines)


def _summarize_dewormings(data):
    dewormings = _data_items(data)
    if not dewormings:
        return "No hay desparasitaciones devueltas por la API."

    lines = []
    for item in dewormings[:8]:
        target = _nested_name(item, "animal", None) or _nested_name(item, "corral", None) or _nested_name(item, "unidadRega", "sin destino")
        product = item.get("producto") or item.get("tipo") or "desparasitacion"
        lines.append(f"- {item.get('fecha') or 'sin fecha'}: {product} en {target}")

    total = data.get("total", len(dewormings)) if isinstance(data, dict) else len(dewormings)
    return f"Desparasitaciones encontradas: {total}.\n" + "\n".join(lines)


def _summarize_reproductive_events(data):
    events = _data_items(data)
    if not events:
        return "No hay eventos reproductivos devueltos por la API."

    lines = []
    for event in events[:8]:
        animal = _nested_name(event, "animal", "animal sin crotal")
        result = event.get("resultado") or "sin resultado"
        lines.append(f"- {event.get('fecha') or 'sin fecha'}: {event.get('tipoEvento') or 'evento'} de {animal}, {result}")

    total = data.get("total", len(events)) if isinstance(data, dict) else len(events)
    return f"Eventos reproductivos encontrados: {total}.\n" + "\n".join(lines)


def _summarize_endpoint_catalog():
    read_lines = [f"- {item['method']} {item['path']}: {item['label']}" for item in READ_ENDPOINTS]
    action_lines = [
        "- {method} {path}: {label} (requiere confirmacion)".format(**endpoint)
        for endpoint in ACTION_ENDPOINTS.values()
    ]

    return (
        "Puedo consultar datos vivos de la app con estas rutas:\n"
        + "\n".join(read_lines)
        + "\n\nPuedo preparar estas acciones, siempre pidiendo confirmacion antes de ejecutar:\n"
        + "\n".join(action_lines)
    )


def _prepare_action_tool(action_key, message):
    endpoint = ACTION_ENDPOINTS[action_key]
    if action_key == "change_pen":
        output_summary, draft = _prepare_change_pen_summary(message, endpoint)
    elif action_key == "animal_discharge":
        output_summary, draft = _prepare_discharge_summary(message, endpoint)
    elif action_key == "birth":
        normalized = _normalize(message)
        draft = {
            "crotales": _ear_tags_from_message(message),
            "expectedSpecies": _expected_species_from_message(normalized),
            "technical_contract": endpoint,
        }
        output_summary = "Preparo el lector para localizar la madre y abrir el formulario de parto."
    elif action_key in READER_ACTION_DRAFTS:
        output_summary, draft = _prepare_reader_action_summary(action_key, endpoint, message)
    else:
        output_summary, draft = _prepare_generic_action_summary(action_key, endpoint)

    ui_action = _ui_action_for_action(action_key, message, draft)
    output_summary = _prepared_ui_summary(action_key, ui_action, output_summary)

    return ToolCall(
        name=f"preparar_{action_key}",
        status="ok",
        input={"message": message},
        output_summary=output_summary,
        data={
            "requires_confirmation": False,
            "action_type": action_key.upper(),
            "endpoint": endpoint,
            "draft": draft,
            "ui_action": ui_action,
            "original_message": message,
        },
    )


def _safe_call(name, input_data, summary_builder, callback):
    try:
        data = callback()
        return ToolCall(
            name=name,
            status="ok",
            input=input_data,
            output_summary=summary_builder(data),
            data=data if isinstance(data, dict) else None,
        )
    except urllib.error.HTTPError as err:
        return ToolCall(
            name=name,
            status="error",
            input=input_data,
            output_summary=f"La API principal respondio con estado {err.code}.",
        )
    except Exception as err:
        return ToolCall(
            name=name,
            status="error",
            input=input_data,
            output_summary=f"No se pudo consultar la API principal: {err}",
        )


def _add_get_call(calls, name, input_data, summary_builder, path, authorization):
    calls.append(_safe_call(name, input_data, summary_builder, lambda: _api_get(path, authorization)))


def _last_month_range():
    today = date.today()
    start = today - timedelta(days=30)
    return start.isoformat(), today.isoformat()


def _wants_excel_export(normalized):
    return any(term in normalized for term in ["excel", "xlsx", "exportar", "exporta", "descargar"]) \
        and any(term in normalized for term in ["baja", "bajas", "muertes", "salidas"])


def _excel_export_tool(message, normalized):
    fecha_desde, fecha_hasta = _last_month_range()
    if not any(term in normalized for term in ["ultimo mes", "ultimos 30 dias", "ultimas 4 semanas"]):
        fecha_desde = ""
        fecha_hasta = ""

    query = {
        "dataset": "discharges",
        "view": "list",
        "groupBy": "period",
        "filters": {
            "fechaDesde": fecha_desde,
            "fechaHasta": fecha_hasta,
        },
    }

    return ToolCall(
        name="preparar_excel_bajas",
        status="ok",
        input={"message": message},
        output_summary="Preparo un Excel de bajas con el listado filtrado. Si la descarga no se completa, abro Estadisticas con ese filtro.",
        data={
            "requires_confirmation": False,
            "action_type": "ANALYTICS_EXPORT",
            "ui_action": {
                "kind": "analytics_export",
                "query": query,
                "fallbackRoute": "/dashboard",
            },
            "original_message": message,
        },
    )


def _breed_query_name(normalized):
    if "majorer" in normalized:
        return "majorera"

    match = re.search(r"\bcuant[ao]s?\s+([a-z0-9 _-]{3,35})\s+tengo\b", normalized)
    if match:
        candidate = match.group(1).strip()
        if candidate not in {"animales", "ovejas", "cabras", "ganado"}:
            return candidate.rstrip("s")

    return None


def _analytics_breed_count_tool(message, normalized, authorization):
    breed_name = _breed_query_name(normalized)
    if not breed_name or not authorization:
        return None

    def build():
        options = _api_get("/analytics/options", authorization)
        breeds = options.get("breeds") or []
        wanted = _normalize(breed_name)
        match = next((
            breed for breed in breeds
            if wanted in _normalize(breed.get("nombre") or breed.get("name") or "")
            or _normalize(breed.get("nombre") or breed.get("name") or "") in wanted
        ), None)

        if not match:
            return {
                "total": None,
                "breedName": breed_name,
                "notFound": True,
            }

        query = {
            "dataset": "animals",
            "view": "list",
            "groupBy": "raza",
            "filters": {
                "razaId": match.get("id"),
                "estadoRegistro": "ACTIVO",
            },
        }
        result = _api_post("/analytics/query", query, authorization)
        result["breedName"] = match.get("nombre") or match.get("name") or breed_name
        result["query"] = query
        return result

    def summarize(data):
        if data.get("notFound"):
            return f"No encuentro una raza registrada como {data.get('breedName')}. Puedes revisarlo en Censo o Configuracion."
        return f"Tienes {data.get('total', 0)} animales activos de raza {data.get('breedName', breed_name)}."

    return _safe_call(
        "consultar_animales_por_raza",
        {"breed": breed_name},
        summarize,
        build,
    )


def _wants_dashboard(normalized):
    return any(
        term in normalized
        for term in [
            "dashboard", "resumen", "explotacion", "cuantas", "cuantos",
            "cuanto ganado", "animales tengo", "ganado tengo", "ovejas tengo",
            "cabras tengo", "en produccion", "en lactacion", "por especie",
            "por estado", "por corral", "estado reproductivo", "gestacional",
            "corrales tengo",
        ]
    )


def _wants_pens(normalized):
    return any(term in normalized for term in ["corrales", "lista corrales", "ver corrales", "que corrales"])


def _wants_catalogs(normalized):
    return any(term in normalized for term in ["catalogo", "catalogos", "estados reproductivos", "enfermedades registradas", "razas registradas", "especies registradas"])


def _wants_movements(normalized):
    return any(term in normalized for term in ["movimientos", "historial de movimientos", "ultimos movimientos", "ultimas entradas", "ultimas salidas"])


def _wants_health_cases(normalized):
    return any(term in normalized for term in ["casos sanitarios", "incidencias sanitarias", "casos abiertos", "sanidad abierta", "historial sanitario"])


def _wants_treatments(normalized):
    return any(term in normalized for term in ["tratamientos", "medicaciones", "retiradas pendientes", "historial de tratamientos"])


def _wants_vaccinations(normalized):
    return any(term in normalized for term in ["vacunaciones", "vacunas puestas", "revacunaciones"])


def _wants_dewormings(normalized):
    return any(term in normalized for term in ["desparasitaciones", "desparasitado", "antiparasitarios"])


def _wants_reproductive_events(normalized):
    return any(term in normalized for term in ["eventos reproductivos", "historial reproductivo", "partos registrados", "cubriciones", "ecografias", "gestaciones"])


def run_app_tools(message, authorization=None):
    normalized = _normalize(message)
    calls = []

    if _wants_endpoint_catalog(normalized):
        calls.append(ToolCall(
            name="catalogo_endpoints_app",
            status="ok",
            input={},
            output_summary=_summarize_endpoint_catalog(),
            data={
                "read_endpoints": READ_ENDPOINTS,
                "action_endpoints": ACTION_ENDPOINTS,
            },
        ))
        return calls

    if _is_watchlist_request(normalized):
        calls.append(ToolCall(
            name="abrir_busqueda_inteligente",
            status="ok",
            input={"message": message},
            output_summary="Abro Busqueda inteligente para que puedas revisar o buscar animales marcados.",
            data={
                "requires_confirmation": False,
                "action_type": "OPEN_ROUTE",
                "ui_action": {
                    "kind": "open_route",
                    "route": "/animal-watchlist",
                },
                "original_message": message,
            },
        ))
        return calls

    if _wants_excel_export(normalized):
        calls.append(_excel_export_tool(message, normalized))
        return calls

    action_key = _action_key_from_message(normalized)
    if action_key:
        calls.append(_prepare_action_tool(action_key, message))
        return calls

    animal_query = _animal_query_from_message(message)
    if animal_query:
        query = urllib.parse.urlencode({"search": animal_query})
        _add_get_call(calls, "buscar_animal_por_crotal", {"query": animal_query}, _summarize_animals, f"/animals?{query}", authorization)

    breed_query = _analytics_breed_count_tool(message, normalized, authorization)
    if breed_query:
        calls.append(breed_query)
        return calls

    if _wants_dashboard(normalized):
        _add_get_call(calls, "consultar_dashboard", {"reason": "consulta_resumen"}, lambda data: _summarize_dashboard(data, message), "/dashboard", authorization)

    if any(word in normalized for word in ["rega", "unidad rega", "numero rega", "codigo rega"]):
        _add_get_call(calls, "listar_unidades_rega", {}, _summarize_farm_units, "/farm-units", authorization)

    if _wants_pens(normalized):
        _add_get_call(calls, "listar_corrales", {}, _summarize_pens, "/pens", authorization)

    if _wants_catalogs(normalized):
        _add_get_call(calls, "listar_catalogos", {}, _summarize_catalogs, "/catalogs", authorization)

    if _wants_movements(normalized):
        _add_get_call(calls, "listar_movimientos", {}, _summarize_movements, "/movements", authorization)

    if _wants_health_cases(normalized):
        _add_get_call(calls, "listar_casos_sanitarios", {}, _summarize_health_cases, "/health-cases", authorization)

    if _wants_treatments(normalized):
        _add_get_call(calls, "listar_tratamientos", {}, _summarize_treatments, "/treatments", authorization)

    if _wants_vaccinations(normalized):
        _add_get_call(calls, "listar_vacunaciones", {}, _summarize_vaccinations, "/vaccinations", authorization)

    if _wants_dewormings(normalized):
        _add_get_call(calls, "listar_desparasitaciones", {}, _summarize_dewormings, "/dewormings", authorization)

    if _wants_reproductive_events(normalized):
        _add_get_call(calls, "listar_eventos_reproductivos", {}, _summarize_reproductive_events, "/reproductive-events", authorization)

    if any(word in normalized for word in ["aviso", "avisos", "recordatorio", "pendiente", "vencido"]):
        path = "/reminders?pending=true" if any(word in normalized for word in ["pendiente", "pendientes", "aviso", "avisos"]) else "/reminders"
        _add_get_call(calls, "listar_avisos", {}, _summarize_reminders, path, authorization)

    return calls
