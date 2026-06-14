import re
import unicodedata
from typing import Any, NotRequired, Required, TypedDict, cast

from app.config import get_settings
from app.schemas import ChatMessage, ChatRequest, ChatResponse, ToolCall, RagSource
from app.services import history_store
from app.services.intent_service import IntentResult, classify_intent
from app.services.learning_queue import add_unresolved_question
from app.services.llm_service import build_llm_answer
from app.services.rag_service import search_documents
from app.services.tools import run_app_tools
from app.services.triage_service import classify_triage


SAFETY_NOTICE = (
    "La IA de RumiAndo ayuda a interpretar informacion ganadera, pero no sustituye "
    "el criterio de un veterinario ni ejecuta acciones sin confirmacion del usuario."
)

RAG_PREFIXES = {
    "veterinary": ("00_triaje/", "10_sanidad/", "20_manejo/", "30_reproduccion/"),
    "management": (
        "20_manejo/",
        "10_sanidad/03_sintomas_frecuentes_aves_perro_gato_en_granja.md",
        "10_sanidad/17_animales_convivientes_perros_gatos_equinos_aves.md"
    ),
    "app_query": ("40_app_flujos/", "30_reproduccion/"),
    "app_action": ("40_app_flujos/", "30_reproduccion/"),
    "memory": (),
    "general": None
}

class RetrievedState(TypedDict):
    sources: list[RagSource]
    tool_calls: list[ToolCall]

class AgentGraphState(TypedDict, total=False):
    request: Required[ChatRequest]
    authorization: NotRequired[str | None]
    previous_history: NotRequired[list[ChatMessage]]
    context: NotRequired[str | None]
    triage: NotRequired[Any]
    intent: NotRequired[Any]
    search_query: NotRequired[str]
    retrieved_state: NotRequired[RetrievedState]
    orchestrator: NotRequired[str]
    sources: NotRequired[list[RagSource]]
    tool_calls: NotRequired[list[ToolCall]]
    requires_confirmation: NotRequired[bool]
    answer: NotRequired[str]
    answer_from_unknown_fallback: NotRequired[bool]
    graph_engine: NotRequired[str]
    graph_error: NotRequired[str | None]


_LANGGRAPH_APP = None
_LANGGRAPH_ERROR = None


def _run_sequential(
    message: str,
    search_query: str,
    intent: IntentResult,
    authorization: str | None = None,
) -> RetrievedState:
    run_tools = intent.kind in {"app_query", "app_action"} or intent.requires_confirmation
    return {
        "sources": search_documents(
            search_query,
            allowed_prefixes=RAG_PREFIXES.get(intent.kind)
        ),
        "tool_calls": run_app_tools(message, authorization) if run_tools else []
    }

def _format_sources(sources):
    if not sources:
        return (
            "No tengo aun documentos RAG de dominio cargados para citar. "
            "Cuando anadas los markdown a `ai-service/knowledge/`, usare esas fuentes."
        )

    lines = []
    seen_files = set()
    for source in sources:
        if source.file in seen_files:
            continue
        seen_files.add(source.file)
        index = len(lines) + 1
        lines.append(f"[{index}] {source.title} ({source.file})")
    return "Fuentes consultadas:\n" + "\n".join(lines)


def _format_tools(tool_calls):
    visible_tools = [
        tool for tool in tool_calls
        if not (
            tool.name == "buscar_animal_por_crotal"
            and "No se encontraron animales" in tool.output_summary
        )
    ]

    if not visible_tools:
        return "No he necesitado consultar datos vivos de la app para esta respuesta."

    return "\n".join(
        f"{tool.name}: {tool.output_summary}"
        for tool in visible_tools
    )


def _dedupe_sources_by_file(sources):
    deduped = []
    seen_files = set()

    for source in sources:
        if source.file in seen_files:
            continue
        seen_files.add(source.file)
        deduped.append(source)

    return deduped


def _normalize_message(message):
    text = unicodedata.normalize("NFKD", message)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def _is_health_or_symptom_query(message):
    if classify_triage(message).is_relevant:
        return True

    normalized = _normalize_message(message)
    keywords = [
        "no come", "tumbada", "tumbado", "llorando", "queja", "quejando",
        "coja", "cojo", "cojera", "diarrea", "tos", "mocos", "ubre",
        "leche", "mastitis", "hinchada", "hinchado", "parto", "aborto",
        "herida", "sangre", "sangrando", "desangrando", "fiebre", "muerta",
        "muerto", "decaida", "decaido", "debil", "respira mal", "asfixia",
        "no se levanta", "lengua azul", "mal de boca", "basquilla"
    ]

    return any(_contains_term(normalized, keyword) for keyword in keywords)


def _contains_term(normalized, term):
    if " " in term:
        return term in normalized

    return re.search(rf"\b{re.escape(term)}\b", normalized) is not None


def _priority_label(priority: str | None) -> str:
    labels = {
        "URGENT": "urgencia veterinaria",
        "HIGH": "prioridad alta",
        "MEDIUM": "prioridad media",
        "LOW": "prioridad baja",
    }

    if not priority:
        return "prioridad media"

    return labels.get(priority, priority.lower())


def _build_triage_answer(message, triage, sources):
    if not triage.is_relevant:
        if not sources:
            return (
                "No lo puedo valorar bien con tan pocos datos. Si el animal esta mal, separalo, "
                "mira respiracion, heridas, fiebre, diarrea, abdomen y si se levanta. Si empeora "
                "o lo ves grave, llama al veterinario."
            )

        return (
            "Con lo que cuentas no puedo cerrar la causa. Separalo y revisa respiracion, postura, "
            "apetito, mucosas, temperatura, diarrea, heridas, abdomen y parto. Si hay dolor fuerte, "
            "sangre, no se levanta, respira mal o empeora, llama al veterinario."
        )
    
    if triage.code == "birth_abortion_postpartum":
        return (
            "URGENTE: llama al veterinario ya.\n\n"
            "Si solo ha salido una pata, has tirado de ella o te has quedado con la pata en la mano, "
            "no sigas tirando. Puede quedar cria/feto retenido y la madre puede tener desgarro, "
            "infeccion o hemorragia.\n\n"
            "Ahora: apartala en cama limpia, evita meter mas la mano, guarda feto/placenta/restos "
            "para el veterinario y no mediques por tu cuenta. El veterinario valorara extraccion, "
            "limpieza y medicacion necesaria."
        )
    if triage.code == "neonate_colostrum":
        return (
            "Prioridad alta: esa cria necesita control ya, sobre todo por el calostro.\n\n"
            "Apartala en cama limpia, seca y templada. Mira si esta fria, mojada, debil, "
            "si se mantiene de pie y si intenta mamar.\n\n"
            "Intenta identificar a la madre: ubre llena, restos de parto, lamido, llamada o "
            "interes por la cria. Si no sabes si tomo calostro, esta fria/debil o no mama, "
            "llama al veterinario o responsable cuanto antes.\n\n"
            "No asumas que ya comio calostro si no lo viste. Registralo en RumiAndo como "
            "incidencia neonatal/nacimiento dudoso con hora aproximada y posible madre."
        )
    if triage.code == "convulsions_neuro":
        return (
            "URGENTE: llama al veterinario ya.\n\n"
            "Si esta tumbada moviendo las patas, temblando fuerte o como convulsionando, aparta objetos "
            "con los que pueda golpearse y dejala en un sitio tranquilo.\n\n"
            "No le metas la mano en la boca, no le des agua/comida y no la fuerces a levantarse. Mira cuanto "
            "dura y si pudo comer veneno, pienso raro o plantas."
        )

    if triage.code == "hemorrhage_trauma":
        normalized = _normalize_message(message)
        if "cuello roto" in normalized or "solo mueve los ojos" in normalized:
            return (
                "URGENTE: llama al veterinario ya.\n\n"
                "No lo muevas ni intentes incorporarlo. Si solo mueve los ojos o sospechas cuello/columna, "
                "puede haber lesion grave de columna o trauma interno.\n\n"
                "Dejalo quieto, en un sitio seguro, vigila que respire y no le des agua, comida ni medicacion "
                "por tu cuenta."
            )

        if "he pisado" in normalized or "pise" in normalized or "lo he pisado" in normalized or "la he pisado" in normalized:
            return (
                "Si lo has pisado y ahora cojea, tratalo como una posible lesion de pata.\n\n"
                "Dejalo quieto en un sitio tranquilo y no lo fuerces a caminar. Mira si apoya algo, si hay hinchazon, "
                "deformidad, herida, sangrado o mucho dolor al tocar.\n\n"
                "Llama al veterinario hoy; urgente si no apoya, llora de dolor, respira raro, esta muy decaido "
                "o ves la pata deformada."
            )

        if "me ha pisado" in normalized or "me piso" in normalized:
            return (
                "Si te ha pisado a ti y no puedes apoyar, hay deformidad, herida abierta, hinchazon fuerte "
                "o dolor intenso, ve a urgencias.\n\n"
                "Mientras tanto, no fuerces el pie/pierna y revisa si el dolor va a mas."
            )

        if "atropell" in normalized or "coche" in normalized:
            return (
                "URGENTE: si lo has atropellado, no lo muevas salvo para quitarlo de peligro.\n\n"
                "Puede tener lesiones internas aunque por fuera no se vea mucho. Dejale respirar tranquilo, revisa "
                "sangrado y si mueve las patas, y mantenlo quieto y abrigado.\n\n"
                "Llama al veterinario ya. No le des agua, comida ni medicacion humana."
            )

        if "piedra" in normalized or "caido algo encima" in normalized or "cayo algo encima" in normalized:
            return (
                "URGENTE: una piedra encima puede haber causado fractura, aplastamiento o lesion interna.\n\n"
                "Aparta la oveja sin hacerla caminar, dejala quieta y revisa respiracion, sangrado, hinchazon "
                "y si puede apoyar las patas.\n\n"
                "Llama al veterinario cuanto antes. No intentes colocar la pata ni darle medicacion por tu cuenta."
            )

        return (
            "URGENTE: necesita valoracion veterinaria cuanto antes.\n\n"
            "Por golpe, atropello, pisoton, sangrado o una pata que no mueve/apoya, puede haber "
            "fractura, lesion interna, dolor serio o shock.\n\n"
            "Ahora: dejalo quieto, separalo, no lo fuerces a caminar y revisa respiracion, sangrado "
            "y mucosas. Si hay herida externa que sangra, presion con pano limpio. No des medicacion "
            "humana ni intentes colocar la pata."
        )

    if triage.code == "bites_attacks":
        normalized = _normalize_message(message)
        if "oveja" in normalized and ("entera" in normalized or "se ha comida" in normalized or "se ha comido" in normalized):
            return (
                "URGENTE: llama al veterinario.\n\n"
                "Un perro que se come una oveja o muchos restos y ahora no se mueve puede tener atragantamiento, "
                "dilatacion/torsion, obstruccion, dolor fuerte, shock o intoxicacion por restos.\n\n"
                "No lo fuerces a moverse, no le des comida ni provoques el vomito. Vigila respiracion, abdomen "
                "hinchado, arcadas, encia palida o azulada y dolor al tocarlo."
            )

        return (
            "Prioridad alta: separa al perro y revisa al pato/animal atacado ya.\n\n"
            "Si el pato sigue vivo, esta herido, sangra, respira mal o no se mantiene en pie, es "
            "veterinario. Si el perro se ha comido partes, huesos o el animal entero, llama al "
            "veterinario y vigila atragantamiento, vomitos, dolor abdominal o decaimiento.\n\n"
            "No provoques el vomito y no dejes al perro con acceso libre a aves o crias."
        )

    if triage.code == "poisoning_toxic":
        normalized = _normalize_message(message)
        if "espuma" in normalized:
            return (
                "URGENTE: llama al veterinario ya.\n\n"
                "Espuma por la boca puede ser intoxicacion, asfixia, dolor fuerte o problema neurologico. "
                "No le metas agua ni comida en la boca.\n\n"
                "Apartala, evita que se golpee, mira si respira bien y revisa si pudo comer veneno, planta, "
                "pienso raro o producto de la nave."
            )

        return (
            "URGENTE: llama al veterinario y guarda el producto o alimento sospechoso.\n\n"
            "Retira el acceso al veneno/pienso/planta/producto, separa a los afectados y mira si hay "
            "mas animales con sintomas. No provoques vomito ni des leche, aceite o remedios caseros "
            "sin indicacion veterinaria."
        )

    if triage.code == "down_animal":
        normalized = _normalize_message(message)
        if "aves" in triage.detected_species:
            return (
                "URGENTE: si la gallina no se mueve pero respira, apartala ya en una caja o sitio limpio, seco y templado.\n\n"
                "Dejala tranquila, con la cabeza libre para respirar. No le des agua ni comida a la fuerza. Mira si hay "
                "sangre, golpe, ala o pata torcida, cuello raro, diarrea, pico abierto o si hay mas aves igual.\n\n"
                "Llama al veterinario cuanto antes, sobre todo si no se incorpora en pocos minutos, respira raro, esta fria "
                "o ha podido recibir un golpe/ataque."
            )

        if "perro" in normalized and ("oveja entera" in normalized or "se ha comida" in normalized or "se ha comido" in normalized or "se comio" in normalized):
            return (
                "URGENTE: llama al veterinario.\n\n"
                "Un perro que se come muchos restos o una oveja y ahora no se mueve puede tener atragantamiento, "
                "dilatacion/torsion, obstruccion, dolor fuerte, shock o intoxicacion por restos.\n\n"
                "No lo fuerces a moverse, no le des comida ni provoques el vomito. Vigila respiracion, abdomen "
                "hinchado, arcadas, encia palida o azulada y dolor al tocarlo."
            )

    if triage.code == "bloat_colic_abdomen":
        normalized = _normalize_message(message)
        if "gas" in normalized or "pinch" in normalized:
            return (
                "No des por hecho que ya esta bien: llama al veterinario.\n\n"
                "Si alguien la ha pinchado y sale gas, puede haber timpanismo, pero tambien una herida abierta, "
                "infeccion o lesion interna. No sigais pinchando ni metiendo nada.\n\n"
                "Mantenla separada y tranquila, vigila respiracion y abdomen, y dile al veterinario exactamente "
                "donde se pincho, con que y cuanto gas salio."
            )

    if triage.code == "death_event":
        normalized = _normalize_message(message)
        if "perro" in normalized and any(term in normalized for term in ["he matado", "mate", "matado sin querer"]):
            return (
                "Si el perro esta muerto, ya no hay primeros auxilios. Aparta a otros animales y no manipules mas de lo necesario.\n\n"
                "Si no estas completamente seguro de que ha muerto, llama al veterinario ya y no lo muevas. Si fue un golpe, atropello "
                "o aplastamiento, tambien conviene avisar al veterinario para confirmar y gestionar el cuerpo correctamente.\n\n"
                "Lavate las manos, evita que otros animales lo toquen y apunta hora y que paso."
            )

        return (
            "Lo siento. Ahora piensa en proteger al resto.\n\n"
            "No dejes que perros, gatos, aves u otros animales toquen el cuerpo o restos. Revisa ya si hay mas "
            "animales con espuma, dificultad para respirar, temblores, animales tumbados, diarrea, abortos o decaimiento.\n\n"
            "Si murio de repente o venia con espuma/convulsiones/intoxicacion sospechada, llama al veterinario "
            "para decidir si hay que revisar lote, agua, pienso o cadaver."
        )

    if triage.code == "hoof_bleeding":
        normalized = _normalize_message(message)
        if "sangre" not in normalized and "cort" not in normalized:
            return (
                "Compruebalo con calma y sin cortar de entrada.\n\n"
                "Aparta la oveja en suelo limpio y seco, levanta la pata con cuidado y mira si la pezuna esta "
                "creciendo hacia dentro, si hay piedra/barro clavado, mal olor, pus, calor, hinchazon o dolor al tocar.\n\n"
                "Si no apoya, hay pus/mal olor, esta muy dolorida o no lo ves claro, mejor veterinario o alguien "
                "con experiencia antes de recortar."
            )

        return (
            "Para de cortar y controla el sangrado.\n\n"
            "Presiona con una gasa o pano limpio unos minutos y deja la oveja en cama seca y limpia. No sigas "
            "recortando ni metas productos fuertes en la herida.\n\n"
            "Veterinario si sangra mucho, no para, no apoya, hay pus, mal olor, hinchazon o fiebre."
        )

    if triage.code == "mastitis_udder":
        return (
            "No uses esa leche hasta que la vea un veterinario.\n\n"
            "Una masa en la ubre puede ser mastitis, absceso, golpe, obstruccion u otra lesion. Separa la oveja "
            "en limpio y mira si la ubre esta caliente, dura, dolorida, roja o si la leche sale con grumos, sangre, "
            "pus o mal olor.\n\n"
            "Si hay fiebre, dolor, decaimiento o leche rara, llama al veterinario pronto."
        )

    if triage.code == "diarrhea_dehydration":
        species = "la oveja" if "ovino" in triage.detected_species else "el animal"
        return (
            f"Si {species} tiene mucha diarrea, separala y ponle agua limpia a mano. No le cortes el agua.\n\n"
            "Mira si hay sangre, si esta decaida, si no come, si tiene fiebre, ojos hundidos, encia seca o si hay mas animales igual. "
            "Revisa tambien cambio de pienso/pasto, parasitos y cama sucia.\n\n"
            "Llama al veterinario pronto; urgente si es una cria, hay sangre, esta debil, no se levanta o hay varios afectados."
        )

    if triage.code == "generic_health":
        normalized = _normalize_message(message)
        if "llorando" in normalized or "queja" in normalized or "quejando" in normalized:
            return (
                "Si una oveja esta llorando o quejandose de forma rara, piensa en dolor o malestar hasta demostrar lo contrario.\n\n"
                "Apartala un momento y revisa patas, barriga hinchada, heridas, ubre, parto/aborto, si come, si rumia y si se levanta normal. "
                "Mira tambien si se ha separado de la cria o del lote.\n\n"
                "Llama al veterinario si sigue quejandose, no come, no se levanta, respira raro, tiene diarrea, sangre, fiebre o dolor al tocarla."
            )

    actions = "\n".join(f"- {item}" for item in triage.immediate_actions[:3])
    do_not = "\n".join(f"- {item}" for item in triage.do_not[:2])

    if triage.priority == "URGENT":
        header = "URGENTE: llama al veterinario ya."
    elif triage.priority == "HIGH":
        header = "Prioridad alta: no lo dejaria para mas tarde."
    else:
        header = f"{_priority_label(triage.priority).capitalize()}."

    return (
        f"{header}\n\n"
        f"Ahora mismo:\n{actions}\n\n"
        f"Evita:\n{do_not}\n\n"
        f"{triage.vet_when}"
    )


def _is_count_memory_question(message):
    normalized = _normalize_message(message)
    return any(term in normalized for term in [
        "cuantas cosas te he preguntado",
        "cuantas preguntas te he hecho",
        "cuantos mensajes te he mandado",
        "cuantas cosas dije",
    ])


def _looks_like_case_memory_question(message):
    normalized = _normalize_message(message)
    return any(term in normalized for term in [
        "que le pasaba",
        "que tenia",
        "que le ocurria",
        "lo de la oveja",
        "lo del animal",
        "como iba lo de",
    ])


def _looks_like_case_update(message):
    normalized = _normalize_message(message)
    noise = ["hola", "pareces un robot", "que te he preguntado", "cuantas cosas"]
    if any(term in normalized for term in noise):
        return False

    terms = [
        "oveja", "cabra", "perro", "gallina", "animal", "coja", "cojo",
        "no se mueve", "no se levanta", "tumbada", "tumbado", "parto",
        "pariendo", "cria", "pata", "jalado", "tirado", "sacado",
        "huele fatal", "diarrea", "espuma", "vomita", "no respira",
        "sangre", "fiebre", "ubre", "leche", "atropell", "pisado",
    ]
    return any(term in normalized for term in terms)


def _case_update_label(message):
    normalized = _normalize_message(message)
    if "coja" in normalized or "cojo" in normalized or "cojera" in normalized:
        return "cojera o problema de pata"
    if "no se mueve" in normalized or "no se levanta" in normalized or "tumbad" in normalized:
        return "luego estaba tumbada, no se movia o no se levantaba"
    if "parto" in normalized or "pariendo" in normalized:
        return "despues aparecio el contexto de parto"
    if any(term in normalized for term in ["jalado", "tirado", "sacado"]) and ("cria" in normalized or "pata" in normalized):
        return "habias tirado o sacado cria/pata durante el parto"
    if "huele fatal" in normalized or "mal olor" in normalized:
        return "aparecio mal olor, que en parto/posparto es una senal mala"
    return message


def _build_case_memory_answer(message, history):
    if not _looks_like_case_memory_question(message):
        return None

    normalized = _normalize_message(message)
    wants_sheep = "oveja" in normalized or "ovejas" in normalized
    user_messages = [
        item.content.strip()
        for item in history
        if item.role == "user" and item.content.strip()
    ]

    case_messages = []
    case_started = not wants_sheep
    for item in user_messages[-12:]:
        item_normalized = _normalize_message(item)
        if wants_sheep and ("oveja" in item_normalized or "ovejas" in item_normalized):
            case_started = True
        if case_started and _looks_like_case_update(item):
            case_messages.append(item)

    if not case_messages:
        return (
            "No tengo suficiente hilo anterior para reconstruir ese caso. "
            "Dime especie y que signo viste primero, y lo retomamos."
        )

    labels = []
    for item in case_messages[-6:]:
        label = _case_update_label(item)
        if label not in labels:
            labels.append(label)

    lines = "\n".join(f"{index}. {label}." for index, label in enumerate(labels, start=1))
    return (
        "De ese caso, lo que me habias contado era:\n"
        f"{lines}\n\n"
        "Con esa secuencia no lo trataria como una duda leve: si hay parto, animal caido, "
        "tirones de la cria/pata o mal olor, es para veterinario cuanto antes."
    )


def _build_memory_answer(history, current_message=None):
    user_messages = [
        message.content.strip()
        for message in history
        if message.role == "user" and message.content.strip()
    ]

    if current_message:
        case_answer = _build_case_memory_answer(current_message, history)
        if case_answer:
            return case_answer

    if not user_messages:
        return (
            "En esta conversacion todavia no tengo preguntas anteriores guardadas. "
            "A partir de ahora puedo usar este hilo para mantener contexto."
        )

    recent = user_messages[-10:]

    if current_message and _is_count_memory_question(current_message):
        lines = "\n".join(
            f"{index}. {content}"
            for index, content in enumerate(recent, start=1)
        )
        return (
            f"Me has preguntado {len(user_messages)} cosas en esta conversacion. "
            "Las ultimas son:\n" + lines
        )

    recent = user_messages[-10:]
    lines = "\n".join(
        f"{index}. {content}"
        for index, content in enumerate(recent, start=1)
    )
    return "En esta conversacion me has preguntado recientemente:\n" + lines


def _is_management_or_cohabitation_question(message):
    normalized = _normalize_message(message)
    management_terms = [
        "duermen", "dormir", "conviven", "convivir", "juntos", "juntas",
        "mezclar", "compartir", "mismo corral", "misma nave", "misma cama",
        "pueden estar", "puedo tener",
        "gallinas con ovejas", "patos con cabras", "perros con ovejas",
        "gatos con cabras", "pavos reales"
    ]
    species_terms = [
        "oveja", "ovejas", "cabra", "cabras", "gallina", "gallinas",
        "pato", "patos", "pavo real", "pavos reales", "perro", "perros",
        "gato", "gatos", "caballo", "yegua", "burro", "mula"
    ]
    return (
        any(term in normalized for term in management_terms)
        and sum(1 for term in species_terms if term in normalized) >= 2
    )


def _build_management_answer(message):
    normalized = _normalize_message(message)

    if "gallina" in normalized and ("oveja" in normalized or "cabra" in normalized):
        return (
            "Respuesta corta: no es lo ideal que las gallinas duerman con ovejas o cabras "
            "en la misma cama o encima de comida/bebederos.\n\n"
            "Durante el dia puede haber patio comun si hay espacio, higiene y no hay estres, "
            "pero para dormir conviene separar zonas. El problema principal no es que se vean, "
            "sino las heces en cama, pacas, comederos y agua, ademas de parasitos, polvo y "
            "mala ventilacion.\n\n"
            "Como manejo seguro: pon gallinero o zona de descanso propia para aves, protege "
            "comederos y bebederos de rumiantes, revisa cama seca y evita acceso a parideras, "
            "crias debiles, lazareto, placentas o animales enfermos."
        )

    if "pato" in normalized and ("oveja" in normalized or "cabra" in normalized):
        return (
            "Con patos la clave es la humedad. Pueden compartir exterior de forma controlada, "
            "pero no conviene que su zona de agua moje la cama de ovejas o cabras.\n\n"
            "Separa bebederos y banos de patos del descanso de rumiantes. Cama humeda significa "
            "mas riesgo de problemas respiratorios, podales, diarreas, enfriamiento de crias y "
            "mal olor."
        )

    return (
        "La convivencia entre especies puede funcionar, pero no deberia significar compartir "
        "cama, comedero, bebedero, paridera o lazareto.\n\n"
        "Revisa espacio, agresiones, humedad, heces en alimento/agua, ventilacion, parasitos "
        "y acceso de perros, gatos o aves a placentas, cadaveres, leche de descarte, piensos "
        "medicados o material sanitario. Si hay crias, paridas, enfermos o animales debiles, "
        "mejor separarlos."
    )


def _is_feeding_question(message):
    normalized = _normalize_message(message)
    feeding_terms = [
        "comer", "come", "comen", "darle", "darles", "pienso", "paja", "heno",
        "alfalfa", "grano", "cebada", "maiz", "avena", "sal", "bloque",
        "agua", "bebedero", "moho", "moj", "pan", "bellota", "lechuga",
        "col", "patata", "cebolla", "chocolate", "sobras", "ensilado"
    ]
    return any(term in normalized for term in feeding_terms)


def _build_feeding_answer(message):
    normalized = _normalize_message(message)

    if "pienso de gallina" in normalized and any(term in normalized for term in ["oveja", "ovejas", "cabra", "cabras", "cordero", "cabrito"]):
        return (
            "No uses pienso de gallina para ovejas o cabras.\n\n"
            "Esta pensado para aves y puede llevar niveles de minerales, aditivos o medicaciones que no corresponden a rumiantes. "
            "Ademas, cambiar de pienso de golpe puede provocar diarrea, acidosis o timpanismo.\n\n"
            "Retiralo y usa alimento de rumiantes. Si ya comio bastante y ves panza hinchada, espuma, diarrea, temblores o decaimiento, llama al veterinario."
        )

    if "pan" in normalized and any(term in normalized for term in ["oveja", "ovejas", "cabra", "cabras", "cordero", "cabrito"]):
        return (
            "Mejor no dar pan como alimento habitual a ovejas o cabras.\n\n"
            "Un trozo pequeno, seco y sin moho no suele ser el mayor problema, pero mucho pan o pan mohoso puede alterar la panza. "
            "No lo uses para sustituir heno/pasto/pienso de rumiantes.\n\n"
            "Si ya comieron bastante y ves panza hinchada, diarrea, espuma, temblores o animales caidos, llama al veterinario."
        )

    if any(term in normalized for term in ["moho", "moj", "podrido", "podrida", "rancio"]):
        return (
            "No des comida con moho, mojada o podrida.\n\n"
            "Retirala del lote y revisa si alguno tiene diarrea, temblores, espuma, no come o esta tumbado. "
            "Si ya han comido bastante o ves sintomas, llama al veterinario y guarda una muestra del alimento."
        )

    if any(term in normalized for term in ["chocolate", "cebolla", "lejia", "raticida", "veneno", "pesticida", "herbicida"]):
        return (
            "No se lo des. Eso puede ser peligroso segun especie y cantidad.\n\n"
            "Si ya lo comio, aparta el alimento, identifica cuanto y a que hora, y llama al veterinario. "
            "No provoques vomito ni des remedios caseros sin indicacion."
        )

    if any(term in normalized for term in ["cambio de pienso", "cambie el pienso", "pienso nuevo", "mucho grano", "mucho maiz", "mucha cebada"]):
        return (
            "Con cambios de pienso o mucho grano, ve con cuidado.\n\n"
            "Los cambios bruscos pueden dar diarrea, acidosis o timpanismo. Haz transicion progresiva, agua limpia siempre y vigila panza hinchada, "
            "animal decaido, diarrea o que deje de rumiar. Si aparece alguno, llama al veterinario."
        )

    if "agua" in normalized or "bebedero" in normalized:
        return (
            "El agua es lo primero: limpia, accesible y suficiente.\n\n"
            "Revisa que el bebedero funcione, que no este sucio, con algas, barro o animales dominantes bloqueando. "
            "Si un animal no bebe y esta decaido, con diarrea, fiebre o no se levanta, no lo dejes pasar."
        )

    return (
        "Como norma de campo: comida limpia, sin moho, cambios poco a poco y agua siempre.\n\n"
        "Para ovejas y cabras, cuidado con exceso de grano, pienso nuevo de golpe, plantas raras, sal sin control o restos de cocina. "
        "Si tras comer aparece panza hinchada, diarrea, espuma, temblores o animales caidos, llama al veterinario."
    )


def _is_common_field_term_question(message):
    normalized = _normalize_message(message)
    terms = [
        "basquilla", "mal de boca", "boquera", "orf", "modorra",
        "sanguinuelo", "sanguiñuelo", "coquera", "pedero", "mal de pezuña",
        "mal de pezuna", "pezuna podrida"
    ]
    return any(term in normalized for term in terms)


def _build_common_field_term_answer(message):
    normalized = _normalize_message(message)

    if "basquilla" in normalized:
        return (
            "Basquilla es un nombre de campo, no un diagnostico cerrado.\n\n"
            "En ovejas y cabras suele usarse para cuadros subitos digestivos o clostridiales, como enterotoxemia, "
            "pero tambien puede confundirse con timpanismo, acidosis, intoxicacion u otros problemas graves.\n\n"
            "Si el animal esta caido, hinchado, con diarrea fuerte, espuma, convulsiones o hay muertes, llama al "
            "veterinario ya y no muevas el lote. Revisa cambio de pienso/pasto, vacunacion clostridial y si hay mas afectados."
        )

    if "mal de boca" in normalized or "boquera" in normalized or "orf" in normalized:
        return (
            "Mal de boca o boquera suele usarse para costras y heridas en labios, boca, nariz o pezones.\n\n"
            "Puede ser ectima contagioso/orf, pero tambien puede confundirse con heridas, lengua azul u otras lesiones. "
            "Usa guantes, separa al animal si hay muchas lesiones y no dejes que crias o personas vulnerables toquen las costras.\n\n"
            "Veterinario si hay fiebre, no come, muchas lesiones, cojera, lengua hinchada o varios animales afectados."
        )

    if "modorra" in normalized:
        return (
            "Modorra es una palabra muy variable: suele significar que el animal esta atontado, raro, debil, da vueltas "
            "o tiene la cabeza torcida.\n\n"
            "Tratalo como problema neurologico o general serio: separalo, dejalo tranquilo, no lo fuerces a caminar y revisa "
            "si pudo comer toxicos o si hay mas animales igual.\n\n"
            "Llama al veterinario si no coordina, esta caido, tiene fiebre, convulsiones o empeora."
        )

    if "coquera" in normalized:
        return (
            "Coquera suele referirse a una herida sucia, con larvas, mal olor o tejido muerto.\n\n"
            "Aparta al animal en limpio y revisa la zona sin arrancar tejido ni meter productos fuertes. Si hay larvas, pus, "
            "mal olor o dolor, necesita veterinario para limpieza y tratamiento correcto."
        )

    if "pedero" in normalized or "mal de pezuña" in normalized or "mal de pezuna" in normalized or "pezuna podrida" in normalized:
        return (
            "Pedero o mal de pezuña suele apuntar a problema podal, sobre todo si hay cojera, mal olor, humedad o varios animales cojos.\n\n"
            "Separa los cojos en suelo seco, revisa pezuñas sin recortar a ciegas y mira si hay pus, calor, hinchazon o dolor fuerte. "
            "Si hay varios afectados, conviene plan con veterinario porque puede ser contagioso y de manejo."
        )

    return None


def _is_laying_question(message):
    normalized = _normalize_message(message)
    return (
        ("gallina" in normalized or "gallinas" in normalized)
        and any(term in normalized for term in ["no pone", "no ponen", "dejo de poner", "ha dejado de poner", "huevos"])
    )


def _build_laying_answer(message):
    normalized = _normalize_message(message)

    if any(term in normalized for term in ["decaida", "decaido", "embolada", "no come", "no bebe", "pico abierto", "sangre", "abdomen hinchado"]):
        return (
            "Si ademas de no poner esta apagada, no come, respira raro o tiene abdomen hinchado, separala y llama al veterinario.\n\n"
            "Puede ser algo mas que una pausa de puesta, incluso huevo retenido u otro problema. No intentes sacar un huevo a la fuerza."
        )

    return (
        "Si la gallina esta normal, que deje de poner no suele ser urgencia.\n\n"
        "Mira primero muda, edad, menos horas de luz, calor/frio, estres, cambio de pienso, falta de calcio, parasitos o si esta poniendo en otro sitio.\n\n"
        "Preocupa si esta embolada, no come, respira con pico abierto, tiene diarrea, abdomen hinchado o hace fuerza como para poner y no sale nada."
    )


def _build_app_query_answer(tool_calls, sources):
    ok_tools = [tool for tool in tool_calls if tool.status == "ok"]
    if ok_tools:
        return "\n\n".join(tool.output_summary for tool in ok_tools)

    if tool_calls:
        return (
            "He intentado consultar datos vivos de la app, pero la tool no ha devuelto un resultado correcto. "
            "Te dejo el detalle abajo para que sepamos si falta backend, permisos o ruta."
        )

    if sources:
        return (
            "He revisado los documentos de flujos de la app relacionados con tu consulta. "
            "Si quieres que consulte un dato vivo, dime el crotal/RFID, aviso, dashboard o accion concreta."
        )

    return (
        "Puedo ayudarte con consultas de app como avisos pendientes, dashboard, busqueda por crotal/RFID "
        "o borradores de movimientos. Necesito que me indiques el dato o accion concreta."
    )


def _build_app_action_answer(tool_calls):
    visible_tools = [
        tool for tool in tool_calls
        if tool.status in {"ok", "skipped"} and tool.output_summary
    ]
    if visible_tools:
        return "\n\n".join(tool.output_summary for tool in visible_tools)

    if tool_calls:
        return (
            "He detectado una accion de la app, pero no he podido preparar el borrador. "
            "Dime la accion y los datos clave otra vez: animal/crotal, corral, fecha y motivo si aplica."
        )

    return (
        "Puedo preparar la accion, pero necesito datos concretos y confirmacion antes de tocar la explotacion."
    )


def _is_human_exposure_question(message, context=None):
    normalized = _normalize_message(message)
    combined = f"{_normalize_message(context or '')}\n{normalized}"

    consumed_milk = any(term in combined for term in [
        "bebi", "bebido", "probe", "probado", "tome leche", "tomado leche",
        "como sabia", "leche"
    ])
    asks_about_self = any(term in normalized for term in [
        "yo que hago", "que hago yo", "conmigo", "para mi", "me puede pasar",
        "me pasara algo", "digo que hago yo"
    ])

    return consumed_milk and (
        asks_about_self
        or any(term in normalized for term in ["bebi", "bebido", "probe", "probado", "como sabia"])
    )


def _build_human_exposure_answer():
    return (
        "Para ti: no bebas mas de esa leche.\n\n"
        "Si fue leche cruda o de una ubre con bulto/dolor/pus/sangre, vigila diarrea, vomitos, dolor de barriga, "
        "fiebre o malestar. Si aparece cualquiera de esos sintomas, si bebio un nino, una embarazada, una persona "
        "mayor o alguien con defensas bajas, llama a un medico/urgencias.\n\n"
        "Apunta cuanto bebiste y a que hora. No des esa leche a nadie y guarda la informacion para el veterinario."
    )


def _build_specific_health_answer(message, context=None):
    normalized = _normalize_message(message)
    combined = f"{_normalize_message(context or '')}\n{normalized}"

    if "no respira" in normalized or "ha dejado de respirar" in normalized:
        return (
            "URGENTE: si no respira, llama al veterinario o urgencias veterinarias ya.\n\n"
            "No le des agua, comida ni medicacion. Comprueba que no tenga la boca obstruida y dejalo con cuello/cabeza "
            "en una posicion que no cierre la via respiratoria, moviendolo lo minimo.\n\n"
            "Si sabes hacer reanimacion basica en esa especie, empieza mientras llega ayuda. Si no, prioriza avisar y "
            "mantenerlo sin golpes ni presion en el pecho."
        )

    if "perro" in combined and any(term in normalized for term in ["vomita", "vomitando", "vomitos", "vomito"]):
        if any(term in normalized for term in ["sangre", "no para", "muchas veces", "decaido", "no se mueve", "no respira"]):
            return (
                "Prioridad alta: un perro vomitando asi necesita veterinario.\n\n"
                "Retira comida, deja agua disponible sin forzar y no le des medicacion humana. Mira si hay sangre, barriga hinchada, "
                "arcadas sin echar nada, veneno, restos, huesos o productos de la nave.\n\n"
                "Urgente si esta decaido, vomita repetido, no puede respirar, tiene barriga hinchada o pudo comer toxicos."
            )

        return (
            "Si el perro esta vomitando, primero quitale comida y observa.\n\n"
            "Deja agua cerca sin obligarlo, mantenlo tranquilo y mira si pudo comer veneno, pienso raro, huesos, basura o restos. "
            "No le des ibuprofeno, paracetamol ni medicacion humana.\n\n"
            "Veterinario hoy si repite vomitos, esta apagado, hay sangre, diarrea fuerte, barriga hinchada, dolor o no retiene agua."
        )

    if any(term in combined for term in ["cordero", "cabrito", "cria", "pollito"]) and "diarrea" in normalized:
        return (
            "Prioridad alta: una cria con diarrea se deshidrata rapido.\n\n"
            "Apartala en cama seca, confirma que bebe o mama, mira si hay sangre, ojos hundidos, frio, debilidad o mas crias igual. "
            "No le cortes el agua ni mediques a ciegas.\n\n"
            "Llama al veterinario pronto; urgente si esta debil, no mama, hay sangre o son varias crias."
        )

    if any(term in combined for term in ["gallina", "gallo", "pato", "pavo", "ave"]) and any(term in normalized for term in ["diarrea", "caca liquida", "culo sucio"]):
        return (
            "En aves, diarrea o culo sucio merece separarla y mirar el lote.\n\n"
            "Ponla en sitio seco, revisa agua, pienso, calor/frio, si esta embolada, respira con pico abierto o hay mas aves igual. "
            "No mezcles con crias ni des antibioticos sin veterinario.\n\n"
            "Veterinario si esta apagada, no come, hay sangre, varias aves afectadas o muertes."
        )

    if any(term in combined for term in ["gallina", "gallo", "pato", "pavo", "ave"]) and any(term in normalized for term in ["en el suelo", "tumbada", "tumbado", "no se mueve", "no levanta"]):
        return (
            "Prioridad alta: una ave en el suelo que respira pero no se mueve no es normal.\n\n"
            "Separala en una caja o zona tranquila, seca y templada. Mira si respira con pico abierto, si esta fria, tiene heridas, diarrea, abdomen duro, cuello raro o patas abiertas. "
            "No la fuerces a comer ni a beber.\n\n"
            "Veterinario si no se levanta pronto, respira mal, esta muy fria/caliente, hay golpes, varias aves igual o sospechas huevo retenido/intoxicacion."
        )

    if any(term in combined for term in ["oveja", "cabra"]) and any(term in normalized for term in ["coja", "cojo", "cojera"]):
        return (
            "Si esta coja, tratala como dolor de pata hasta verla bien.\n\n"
            "Apartala en suelo seco y mira la pezuna: piedra clavada, barro, mal olor, pus, calor, hinchazon, herida o si no apoya nada. "
            "No recortes a ciegas si no ves claro donde esta el problema.\n\n"
            "Veterinario o alguien con experiencia si no apoya, hay pus/mal olor, esta muy dolorida, hay fiebre o ves varias cojas."
        )

    if any(term in combined for term in ["caballo", "yegua", "potro", "burro", "mula", "vaca", "ternero"]) and any(term in normalized for term in ["cojea", "coja", "cojo", "cojera", "no apoya"]):
        return (
            "Si un caballo, burro o vaca cojea, no lo fuerces a andar.\n\n"
            "Dejalo quieto en suelo seguro y revisa casco/pezuna y pata: piedra, clavo, herida, calor, hinchazon, deformidad o si no apoya nada. "
            "No des medicacion humana ni intentes corregir una postura rara a la fuerza.\n\n"
            "Llama al veterinario o herrador/veterinario segun el caso; urgente si no apoya, hay herida profunda, hinchazon fuerte, mucho dolor o empeora rapido."
        )

    if any(term in combined for term in ["oveja", "cabra"]) and any(term in normalized for term in ["llorando", "quejando", "queja", "balando raro"]):
        return (
            "Si una oveja o cabra esta llorando o quejandose raro, piensa en dolor o estres.\n\n"
            "Apartala un momento y revisa patas, barriga hinchada, heridas, ubre, parto/aborto, si come, si rumia y si se ha separado de la cria o del lote.\n\n"
            "Llama al veterinario si sigue quejandose, no come, no se levanta, respira raro, tiene diarrea, sangre, fiebre o dolor al tocarla."
        )

    if any(term in normalized for term in ["esta de parto", "esta pariendo", "de parto", "pariendo"]):
        if any(term in combined for term in ["no se mueve", "no se levanta", "tumbada", "tumbado", "caida", "caido"]):
            return (
                "Si esta de parto y ademas esta tumbada o no se mueve, tratalo como urgencia.\n\n"
                "Apartala en cama limpia, mira si asoma bolsa, cabeza o patas, si sangra, si huele mal y cuanto tiempo lleva asi. "
                "No tires fuerte ni metas la mano sin higiene y sin saber la postura.\n\n"
                "Llama al veterinario ya si lleva rato haciendo fuerza sin avanzar, solo sale una pata/cabeza, hay mal olor, sangre, esta agotada o no se levanta."
            )

        return (
            "Si esta de parto, vigila sin precipitarte.\n\n"
            "Mira desde cuando hace fuerza, si asoma bolsa, cabeza o dos patas, y si la madre esta alerta. Prepara cama limpia y dejala tranquila.\n\n"
            "Llama al veterinario si no avanza, solo sale una pata, hay mal olor, sangre, la madre esta muy agotada/tumbada o has tenido que tirar."
        )

    if any(term in combined for term in ["parto", "pariendo", "parida"]) and any(term in normalized for term in ["jalado", "tirado", "sacado la cria", "saque la cria", "sacado solo", "solo una pata"]):
        return (
            "URGENTE: llama al veterinario ya.\n\n"
            "Si has tirado de la cria o solo ha salido una pata, no sigas tirando. Puede quedar otra cria/feto dentro, haber desgarro, "
            "hemorragia o infeccion.\n\n"
            "Deja a la madre en cama limpia, no metas mas la mano si no hace falta y guarda placenta/restos para ensenarselos al veterinario. "
            "Mira si sangra mucho, huele mal, esta caida o sigue haciendo fuerza."
        )

    if any(term in combined for term in ["parto", "pariendo", "parida", "cria", "placenta"]) and any(term in normalized for term in ["huele fatal", "mal olor", "olor fatal", "huele mal"]):
        return (
            "URGENTE: mal olor en parto o posparto es mala senal.\n\n"
            "Puede haber feto/placenta retenida, infeccion o tejido muerto. Apartala en limpio, no sigas manipulando y no dejes restos al alcance "
            "de perros, gatos o aves.\n\n"
            "Llama al veterinario ya, sobre todo si esta decaida, tiene fiebre, sangra, no se levanta o sigue expulsando liquido con mal olor."
        )

    has_respiratory_sign = any(
        _contains_term(normalized, term)
        for term in ["tos", "mocos", "estornuda", "ruido al respirar"]
    )
    if has_respiratory_sign:
        if any(term in normalized for term in ["respira mal", "boca abierta", "pico abierto", "azul", "no se levanta"]):
            return (
                "URGENTE: si ademas de tos o mocos respira mal, llama al veterinario ya.\n\n"
                "Apartalo sin estresarlo, evita polvo y corrientes fuertes, y revisa si hay mas animales igual. "
                "No lo fuerces a caminar ni le des medicacion humana."
            )

        return (
            "Tos o mocos pueden empezar leve, pero mira el lote.\n\n"
            "Aparta si esta decaido, revisa ventilacion, polvo, humedad de cama, fiebre, apetito y si hay mas animales con tos. "
            "Veterinario si respira raro, no come, tiene fiebre, es cria o hay varios afectados."
        )

    if any(term in normalized for term in ["ojo blanco", "ojo cerrado", "ojo hinchado", "lagrimea", "nube en el ojo", "ciego"]):
        return (
            "Un ojo cerrado, blanco o hinchado no lo dejes pasar.\n\n"
            "Aparta al animal si se golpea o si hay varios con ojos mal, evita polvo y no metas productos fuertes en el ojo. "
            "Veterinario si hay nube/blanco, herida, pus, dolor, no abre el ojo o afecta a varios."
        )

    if any(term in normalized for term in ["bulto", "masa", "hinchazon", "absceso", "grano grande"]):
        if "ubre" in combined:
            return None

        return (
            "Un bulto puede ser golpe, absceso, hernia, picadura u otra cosa; no lo pinches a ciegas.\n\n"
            "Mira si esta caliente, duele, crece rapido, supura, huele mal o el animal esta decaido. "
            "Si hay fiebre, dolor fuerte, pus, mal olor o esta cerca de garganta/ubre/barriga, llama al veterinario."
        )

    if any(term in normalized for term in ["gusanos", "larvas", "bicheras", "coquera", "huele podrido"]):
        return (
            "Prioridad alta: si hay gusanos, larvas o herida con mal olor, necesita limpieza correcta.\n\n"
            "Apartalo en limpio, evita que otros animales laman la zona y no arranques tejido ni metas productos fuertes. "
            "Llama al veterinario para limpiar bien y valorar tratamiento."
        )

    return None


def _is_style_feedback(message):
    normalized = _normalize_message(message)
    style_terms = [
        "pareces un robot", "suena a robot", "hablas como un robot",
        "muy robot", "respuesta robotica", "no hables asi", "habla normal",
        "no me contestes asi", "muy largo", "demasiado largo", "mas claro",
        "se directo", "se mas directo", "no te entiendo"
    ]
    return any(term in normalized for term in style_terms)


def _build_style_feedback_answer():
    return (
        "Tienes razon. Voy a contestar mas claro y menos en modo ficha.\n\n"
        "Para urgencias te dire primero que hacer, en pocas frases. Si necesito datos, te pedire solo los importantes."
    )


def _should_try_unknown_llm_fallback(intent, triage, sources):
    if intent.kind == "general":
        return True

    if intent.kind == "veterinary" and triage.code == "generic_health" and len(sources) < 2:
        return True

    if intent.kind == "veterinary" and not triage.is_relevant and not sources:
        return True

    return False


def _should_queue_for_review(intent, triage, answer_from_unknown_fallback=False, sources=None):
    sources = sources or []

    if answer_from_unknown_fallback:
        return True

    if getattr(triage, "code", None) == "generic_health" and len(sources) < 2:
        return True

    if intent.kind == "general" and len(sources) < 2:
        return True

    return False


def _should_use_context(message):
    normalized = _normalize_message(message).strip()
    if normalized in {"si", "sí", "vale", "ok"}:
        return True

    followup_starts = (
    "pero ", "y ", "tambien ", "también ", "ahora ", "entonces ",
    "yo creo", "creo que", "me parece", "pues "
)
    context_terms = [
    "solo la pata", "la pata", "eso", "lo mismo", "sigue", "no mejora",
    "yo que hago", "que hago yo", "conmigo", "lo intente mover", "chilla",
    "jadea", "sale gas", "saliendo gas", "pincho", "se ha muerto", "murio",
    "ha muerto", "esta muerto", "esta muerta", "muerto", "muerta",
    "fallecio", "fallecido", "fallecida", "no se mueve",
    "sangre", "sale sangre", "lo intente", "le pincho",
    "huele fatal", "huele mal", "mal olor", "jalado", "he jalado",

    "golpe", "coche", "atropello", "atropellado", "atropellada",
    "fue del golpe", "creo que fue", "le di", "le he dado",
    "accidente", "trauma",

    "parto", "pariendo", "pario", "parida", "cria", "crias", "madre", "calostro",
    "no mama", "no ha mamado", "no se cual es la madre",
    "diarrea", "tiene mucha", "tiene mucho", "no come", "no bebe",
    "esta peor", "empeoro", "ha empeorado", "sigue igual",

    "por especie", "por estado", "por corral", "en produccion",
    "en lactacion", "las ovejas", "las cabras", "solo activos"
]
    return normalized.startswith(followup_starts) or any(term in normalized for term in context_terms)


def _is_clear_app_action_message(message):
    normalized = _normalize_message(message)
    if any(phrase in normalized for phrase in ["pasa algo", "que pasa si", "puede pasar algo"]):
        return False

    movement_words = [
        "mover", "mueve", "muevo", "traslada", "trasladar", "pasar",
        "pasa", "mete", "meter", "aparta", "apartar", "cambio de corral",
        "cambiar", "cambia", "cambiar de corral", "cambiar de sitio", "cambia de sitio",
    ]
    movement_context = [
        "corral", "lote", "crotal", "crotales", "rfid", "lector",
        "sitio", "oveja", "ovejas", "cabra", "cabras", "ganado"
    ]
    if any(word in normalized for word in movement_words) and any(word in normalized for word in movement_context):
        return True

    action_verbs = [
        "crea", "crear", "registra", "registrar", "alta", "dar de alta",
        "actualiza", "actualizar", "modifica", "modificar", "abre", "abrir",
        "cierra", "cerrar", "completa", "completar", "pospone", "posponer",
        "exporta", "exportar",
    ]
    app_terms = [
        "animal", "crotal", "corral", "lote", "rega", "aviso", "recordatorio",
        "caso sanitario", "tratamiento", "vacuna", "vacunacion",
        "desparasitacion", "evento reproductivo", "gestacion", "exportacion",
    ]
    return any(verb in normalized for verb in action_verbs) and any(term in normalized for term in app_terms)


def _recent_user_context(history, limit=3):
    messages = [
        message.content.strip()
        for message in history
        if message.role == "user" and message.content.strip()
    ]
    return "\n".join(messages[-limit:])


def _history_from_request_context(context, current_message=None):
    settings = get_settings()
    raw_messages = (context or {}).get("recent_messages", [])
    messages = []

    for item in raw_messages[-settings.max_history_messages - 1:]:
        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content")
        if role not in {"user", "assistant"}:
            continue
        if not isinstance(content, str) or not content.strip():
            continue

        messages.append(ChatMessage(role=role, content=content.strip()))

    if messages and current_message:
        last = messages[-1]
        if last.role == "user" and _normalize_message(last.content) == _normalize_message(current_message):
            messages.pop()

    return messages[-settings.max_history_messages:]


def _extract_ear_tags(text):
    return [
        token.upper()
        for token in re.findall(
            r"\b(?:es[-_]?)?[a-z]{0,12}\d[a-z0-9_/-]{2,}\b",
            text or "",
            flags=re.IGNORECASE,
        )
    ]


def _discharge_reason_from_text(normalized):
    if any(term in normalized for term in ["muerte", "muerto", "muerta", "murio", "fallecio", "fallecido", "fallecida"]):
        return "muerte"
    if any(term in normalized for term in ["venta", "vendido", "vendida", "vender"]):
        return "venta"
    if any(term in normalized for term in ["sacrificio", "matadero", "sacrificado", "sacrificada"]):
        return "sacrificio"
    if any(term in normalized for term in ["traslado", "salida", "otra explotacion", "otro rega"]):
        return "traslado"
    return None


def _date_from_text(normalized):
    if "hoy" in normalized:
        return "hoy"
    if "ayer" in normalized:
        return "ayer"
    if "manana" in normalized:
        return "manana"

    match = re.search(r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b", normalized)
    return match.group(0) if match else None


def _discharge_notes_from_text(normalized):
    no_cause_terms = [
        "sin causa", "sin mas causa", "sin mas causas", "no hay causa",
        "no hay mas causa", "no hay mas causas", "ninguna causa",
        "sin detalles", "no hay detalles"
    ]
    if any(term in normalized for term in no_cause_terms):
        return "sin causa adicional"
    return None


def _pending_discharge_details(message, history):
    user_messages = [
        item.content.strip()
        for item in history
        if item.role == "user" and item.content.strip()
    ]
    recent = user_messages[-8:]
    normalized_recent = [_normalize_message(item) for item in recent]
    normalized_current = _normalize_message(message)
    combined_text = "\n".join(recent + [message])
    combined_normalized = _normalize_message(combined_text)

    has_previous_discharge = any(
        ("baja" in item or "dar de baja" in item or "fecha salida" in item)
        and _extract_ear_tags(original)
        for item, original in zip(normalized_recent, recent)
    )
    if not has_previous_discharge:
        return None

    is_followup = (
        bool(_discharge_reason_from_text(normalized_current))
        or bool(_date_from_text(normalized_current))
        or bool(_discharge_notes_from_text(normalized_current))
        or normalized_current.strip() in {"por muerte", "por venta", "por sacrificio", "por traslado"}
    )
    if not is_followup:
        return None

    ear_tags = _extract_ear_tags(combined_text)
    reason = _discharge_reason_from_text(combined_normalized)
    when = _date_from_text(combined_normalized)
    notes = _discharge_notes_from_text(combined_normalized)

    return {
        "crotal": ear_tags[-1] if ear_tags else None,
        "motivo": reason,
        "fecha": when,
        "observaciones": notes,
    }


def _build_pending_discharge_tool(message, history):
    details = _pending_discharge_details(message, history)
    if not details:
        return None

    crotal = details.get("crotal")
    reason = details.get("motivo")
    when = details.get("fecha")
    notes = details.get("observaciones")
    missing = []
    if not crotal:
        missing.append("crotal")
    if not reason:
        missing.append("motivo")
    if not when:
        missing.append("fecha")

    if missing:
        if reason and not when:
            summary = (
                f"Vale, dejo el motivo como {reason}. "
                "Dime la fecha de baja; si es hoy puedes decir solo: hoy."
            )
        else:
            summary = (
                "Puedo preparar la baja, pero falta "
                + ", ".join(missing)
                + ". No la registro sin confirmacion final."
            )
    else:
        note_text = notes or "sin causa adicional indicada"
        summary = (
            f"Tengo preparada la baja de {crotal} por {reason}, con fecha {when}. "
            f"Observaciones: {note_text}.\nConfirma si quieres registrarla."
        )

    return ToolCall(
        name="preparar_animal_discharge",
        status="ok",
        input={"message": message, "from_context": True},
        output_summary=summary,
        data={
            "requires_confirmation": False,
            "action_type": "ANIMAL_DISCHARGE",
            "draft": details,
            "ui_action": {
                "kind": "silent_reader",
                "action": "baja",
                "route": "/animals/:id/discharge",
                "crotales": [crotal] if crotal else [],
                "draft": details,
            },
            "original_message": message,
        },
    )


def _looks_like_death_report(message, context=None):
    normalized = _normalize_message(message)
    combined = f"{_normalize_message(context or '')}\n{normalized}"
    death_terms = [
        "se ha muerto", "se murio", "ha muerto", "esta muerto", "esta muerta",
        "muerto", "muerta", "fallecio", "fallecido", "fallecida",
        "he matado", "mate sin querer", "matado sin querer"
    ]
    human_terms = [
        "mi hijo", "mi hija", "mi padre", "mi madre", "mi abuelo",
        "mi abuela", "persona", "vecino", "hombre", "mujer"
    ]
    current_reports_death = any(term in normalized for term in death_terms)
    context_reports_death = any(term in combined for term in death_terms)
    current_has_ear_tag = bool(_extract_ear_tags(message))

    if any(term in combined for term in human_terms):
        return False

    return (
        current_reports_death
        or (context_reports_death and current_has_ear_tag)
    )


def _death_observations_from_context(combined_normalized):
    accident_terms = [
        "atropell", "coche", "le di con el coche", "le he dado con el coche",
        "accidente", "tractor", "quad", "remolque"
    ]
    trauma_terms = [
        "golpe", "piedra", "aplast", "pisado", "pisoton", "caida",
        "cayo", "techo", "patada", "cornada"
    ]

    if any(term in combined_normalized for term in accident_terms):
        return "muerte tras atropello o accidente"
    if any(term in combined_normalized for term in trauma_terms):
        return "muerte tras traumatismo"
    return "muerte indicada por el usuario"


def _build_death_discharge_tool(message, history, context=None):
    user_messages = [
        item.content.strip()
        for item in history
        if item.role == "user" and item.content.strip()
    ]
    recent = user_messages[-8:]
    combined_text = "\n".join(recent + [message])
    combined_context = f"{context or ''}\n{combined_text}"

    if not _looks_like_death_report(message, context=combined_context):
        return None

    combined_normalized = _normalize_message(combined_text)
    ear_tags = _extract_ear_tags(combined_text)
    crotal = ear_tags[-1] if ear_tags else None
    when = _date_from_text(combined_normalized) or "hoy"
    notes = _death_observations_from_context(combined_normalized)

    details = {
        "crotal": crotal,
        "motivo": "muerte",
        "fecha": when,
        "observaciones": notes,
    }

    if crotal:
        summary = (
            f"He detectado muerte y preparo la pantalla de baja de {crotal}.\n\n"
            f"Motivo: muerte.\n"
            f"Fecha: {when}.\n"
            f"Observaciones: {notes}.\n\n"
            "Se abrira la ficha de baja para que revises y registres desde la app."
        )
    else:
        summary = (
            "He detectado que el animal ha muerto, asi que toca gestionar una baja por muerte.\n\n"
            f"Motivo: muerte.\n"
            f"Fecha provisional: {when}.\n"
            f"Observaciones: {notes}.\n\n"
            "Pasa el lector o dime el crotal/RFID del animal. "
            "La app abrira la pantalla de baja cuando lo localice."
        )

    return ToolCall(
        name="preparar_baja_por_muerte",
        status="ok",
        input={"message": message, "from_context": True},
        output_summary=summary,
        data={
            "requires_confirmation": False,
            "action_type": "ANIMAL_DISCHARGE",
            "draft": details,
            "ui_action": {
                "kind": "silent_reader",
                "action": "baja",
                "route": "/animals/:id/discharge",
                "crotales": [crotal] if crotal else [],
                "draft": details,
            },
            "original_message": message,
        },
    )


def _build_action_confirmation_tool(message, history):
    normalized = _normalize_message(message).strip()
    confirmation_terms = [
        "confirmo", "confirmado", "registrala", "registralo", "hazlo",
        "adelante", "muevelo", "muevela", "dale", "ejecuta"
    ]
    if not any(term in normalized for term in confirmation_terms):
        return None

    recent_text = "\n".join(
        item.content.strip()
        for item in history[-8:]
        if item.content.strip()
    )
    recent_normalized = _normalize_message(recent_text)

    if "tengo preparado el movimiento" in recent_normalized:
        action_type = "CHANGE_PEN"
        summary = (
            "Confirmacion recibida para el movimiento. "
            "En esta version lo dejo como borrador pendiente; no modifico el corral desde el chat hasta cerrar la ejecucion real."
        )
    elif "tengo preparada la baja" in recent_normalized:
        action_type = "ANIMAL_DISCHARGE"
        summary = (
            "Confirmacion recibida para la baja. "
            "En esta version la dejo como borrador pendiente; no cambio el estado del animal desde el chat hasta cerrar la ejecucion real."
        )
    else:
        return None

    return ToolCall(
        name="confirmacion_accion_pendiente",
        status="skipped",
        input={"message": message, "from_context": True},
        output_summary=summary,
        data={
            "requires_confirmation": False,
            "action_type": action_type,
            "execution_status": "pending_final_route",
        },
    )


def _build_context_followup_answer(message, context):
    normalized = _normalize_message(message).strip()
    combined = f"{_normalize_message(context or '')}\n{normalized}"

    if normalized in {"si", "sí", "vale", "ok"} and ("se ha muerto" in combined or "se murio" in combined):
        return (
            "Revisa el lote ahora, uno por uno.\n\n"
            "Busca espuma en boca, dificultad para respirar, temblores, animales tumbados, diarrea, abortos, "
            "decaimiento o comida/agua sospechosa. Separa cualquier animal raro y no dejes que otros animales "
            "toquen el cadaver o restos.\n\n"
            "Si ves otro afectado o no sabes la causa de la muerte, llama al veterinario."
        )

    if "jadea" in normalized and "chilla" in normalized:
        return (
            "URGENTE: no lo muevas mas y llama al veterinario.\n\n"
            "Jadear y chillar al moverlo despues de una caida, golpe o atracon fuerte puede ser dolor serio, "
            "fractura, lesion interna o abdomen comprometido.\n\n"
            "Dejalo quieto, vigila respiracion y color de encias, y no le des comida, agua ni medicacion sin indicacion."
        )

    return None


def _build_local_answer(message, sources, tool_calls, triage, intent, context=None):
    common_term_answer = _build_common_field_term_answer(message)
    if common_term_answer:
        return common_term_answer

    if _is_laying_question(message):
        return _build_laying_answer(message)

    specific_health_answer = _build_specific_health_answer(message, context=context)
    if specific_health_answer:
        return specific_health_answer

    if intent.kind == "app_action":
        return _build_app_action_answer(tool_calls)

    if intent.kind == "app_query":
        return _build_app_query_answer(tool_calls, sources)

    if intent.kind == "veterinary" or triage.is_relevant or _is_health_or_symptom_query(message):
        return _build_triage_answer(message, triage, sources)

    if _is_feeding_question(message):
        return _build_feeding_answer(message)

    if intent.kind == "management" or _is_management_or_cohabitation_question(message):
        return _build_management_answer(message)

    return (
        "No tengo una respuesta fiable con la base actual. Lo dejo marcado para revisar y añadir "
        "a la biblioteca RAG si es una pregunta real de campo.\n\n"
        "Mientras tanto, si hay dolor fuerte, sangre, dificultad para respirar, no se levanta, "
        "parto atascado, intoxicacion o empeora rapido, llama al veterinario."
    )


def _is_low_confidence_local_answer(answer):
    normalized = _normalize_message(answer or "")
    return normalized.startswith((
        "no tengo una respuesta fiable",
        "no lo puedo valorar bien",
        "con lo que cuentas no puedo cerrar"
    ))


def _graph_analyze(state: AgentGraphState):
    request = state["request"]
    previous_history = state.get("previous_history", [])
    use_context = _should_use_context(request.message) and not _is_clear_app_action_message(request.message)
    context = _recent_user_context(previous_history) if use_context else None
    triage = classify_triage(request.message, context=context)
    intent = classify_intent(request.message, triage)

    if _build_action_confirmation_tool(request.message, previous_history):
        intent = IntentResult(
            kind="app_action",
            reason="confirmacion de accion pendiente",
            requires_confirmation=False,
            search_query="confirmacion accion app pendiente"
        )
    elif _build_death_discharge_tool(request.message, previous_history, context=context):
        intent = IntentResult(
            kind="app_action",
            reason="muerte detectada; preparar baja de animal",
            requires_confirmation=False,
            search_query="baja animal por muerte accidente cadaver"
        )
    elif _build_pending_discharge_tool(request.message, previous_history):
        intent = IntentResult(
            kind="app_action",
            reason="seguimiento de baja de animal",
            requires_confirmation=False,
            search_query="baja animal confirmacion app"
        )
    elif _looks_like_case_memory_question(request.message):
        intent = IntentResult(
            kind="memory",
            reason="pregunta sobre caso anterior"
        )

    search_query = intent.search_query or triage.suggested_rag_query or request.message

    return {
        "context": context,
        "triage": triage,
        "intent": intent,
        "search_query": search_query,
    }


def _graph_retrieve(state: AgentGraphState):
    request = state["request"]
    authorization = state.get("authorization")

    intent = cast(IntentResult | None, state.get("intent"))
    if intent is None:
        raise RuntimeError("AgentGraphState missing 'intent'. _graph_analyze must run before _graph_retrieve.")

    search_query = state.get("search_query")
    if search_query is None:
        raise RuntimeError("AgentGraphState missing 'search_query'. _graph_analyze must run before _graph_retrieve.")

    previous_history = state.get("previous_history", [])
    context = state.get("context")
    action_confirmation_tool = _build_action_confirmation_tool(request.message, previous_history)
    death_discharge_tool = _build_death_discharge_tool(request.message, previous_history, context=context)
    pending_discharge_tool = _build_pending_discharge_tool(request.message, previous_history)

    if action_confirmation_tool:
        retrieved_state: RetrievedState = {
            "sources": [],
            "tool_calls": [action_confirmation_tool],
        }
        orchestrator = "app_action: confirmacion de accion pendiente"

    elif death_discharge_tool:
        retrieved_state = {
            "sources": search_documents(
                search_query,
                allowed_prefixes=RAG_PREFIXES.get("app_action")
            ),
            "tool_calls": [death_discharge_tool],
        }
        orchestrator = "app_action: baja por muerte detectada"

    elif pending_discharge_tool:
        retrieved_state = {
            "sources": search_documents(
                search_query,
                allowed_prefixes=RAG_PREFIXES.get("app_action")
            ),
            "tool_calls": [pending_discharge_tool],
        }
        orchestrator = "app_action: seguimiento de baja de animal"

    elif intent.kind == "memory":
        retrieved_state = {"sources": [], "tool_calls": []}
        orchestrator = "memoria local"

    else:
        retrieved_state = _run_sequential(request.message, search_query, intent, authorization)
        orchestrator = f"{intent.kind}: {intent.reason}"

    return {
        "retrieved_state": retrieved_state,
        "orchestrator": orchestrator,
    }

def _graph_prepare_context(state: AgentGraphState):
    intent = cast(IntentResult | None, state.get("intent"))
    if intent is None:
        raise RuntimeError("AgentGraphState missing 'intent'. _graph_analyze must run before _graph_prepare_context.")

    retrieved_state = cast(
        RetrievedState,
        state.get("retrieved_state", {"sources": [], "tool_calls": []})
    )

    sources = _dedupe_sources_by_file(retrieved_state.get("sources", []))
    tool_calls = retrieved_state.get("tool_calls", [])

    requires_confirmation = intent.requires_confirmation or any(
        tool.data and tool.data.get("requires_confirmation")
        for tool in tool_calls
    )

    return {
        "sources": sources,
        "tool_calls": tool_calls,
        "requires_confirmation": requires_confirmation,
    }

def _graph_compose_answer(state: AgentGraphState):
    request = state["request"]
    previous_history = state.get("previous_history", [])
    context = state.get("context")

    triage = state.get("triage")
    if triage is None:
        raise RuntimeError("AgentGraphState missing 'triage'. _graph_analyze must run before _graph_compose_answer.")

    intent = cast(IntentResult | None, state.get("intent"))
    if intent is None:
        raise RuntimeError("AgentGraphState missing 'intent'. _graph_analyze must run before _graph_compose_answer.")

    sources = cast(list[RagSource], state.get("sources", []))
    tool_calls = cast(list[ToolCall], state.get("tool_calls", []))
    requires_confirmation = state.get("requires_confirmation", False)

    context_answer = _build_context_followup_answer(request.message, context)
    human_exposure = _is_human_exposure_question(request.message, context=context)
    style_feedback = _is_style_feedback(request.message)

    answer_from_unknown_fallback = False

    if intent.kind == "memory":
        answer = _build_memory_answer(previous_history, request.message)
    elif style_feedback:
        answer = _build_style_feedback_answer()
    elif context_answer:
        answer = context_answer
    elif human_exposure:
        answer = _build_human_exposure_answer()
    else:
        answer = _build_local_answer(request.message, sources, tool_calls, triage, intent, context=context)
        if _is_low_confidence_local_answer(answer) and _should_try_unknown_llm_fallback(intent, triage, sources):
            fallback_answer = build_llm_answer(
                request.message,
                sources,
                tool_calls,
                requires_confirmation=requires_confirmation,
                history=previous_history,
                triage=triage,
                intent=intent,
                force=True
            )
            if fallback_answer:
                answer = fallback_answer
                answer_from_unknown_fallback = True

    return {
        "answer": answer,
        "answer_from_unknown_fallback": answer_from_unknown_fallback,
    }

def _graph_queue_learning(state: AgentGraphState):
    request = state["request"]

    triage = state.get("triage")
    if triage is None:
        raise RuntimeError("AgentGraphState missing 'triage'. _graph_analyze must run before _graph_queue_learning.")

    intent = cast(IntentResult | None, state.get("intent"))
    if intent is None:
        raise RuntimeError("AgentGraphState missing 'intent'. _graph_analyze must run before _graph_queue_learning.")

    sources = cast(list[RagSource], state.get("sources", []))
    answer = state.get("answer")
    answer_from_unknown_fallback = state.get("answer_from_unknown_fallback", False)

    if _should_queue_for_review(intent, triage, answer_from_unknown_fallback, sources):
        add_unresolved_question(
            message=request.message,
            intent=intent,
            triage=triage,
            sources=sources,
            reason=(
                "answered_by_openai_fallback"
                if answer_from_unknown_fallback
                else "needs_rag_review"
            ),
            answer_preview=answer[:1200] if answer else None
        )

    return {}

def _build_langgraph_app():
    global _LANGGRAPH_APP, _LANGGRAPH_ERROR

    if _LANGGRAPH_APP is not None:
        return _LANGGRAPH_APP

    if _LANGGRAPH_ERROR is not None:
        return None

    try:
        from langgraph.graph import END, StateGraph
    except Exception as err:
        _LANGGRAPH_ERROR = str(err)
        return None

    graph = StateGraph(AgentGraphState)
    graph.add_node("analyze", _graph_analyze)
    graph.add_node("retrieve", _graph_retrieve)
    graph.add_node("prepare_context", _graph_prepare_context)
    graph.add_node("compose_answer", _graph_compose_answer)
    graph.add_node("queue_learning", _graph_queue_learning)

    graph.set_entry_point("analyze")
    graph.add_edge("analyze", "retrieve")
    graph.add_edge("retrieve", "prepare_context")
    graph.add_edge("prepare_context", "compose_answer")
    graph.add_edge("compose_answer", "queue_learning")
    graph.add_edge("queue_learning", END)

    _LANGGRAPH_APP = graph.compile()
    return _LANGGRAPH_APP


def _run_graph_nodes_sequentially(
    initial_state: AgentGraphState,
    engine: str = "sequential_fallback",
) -> AgentGraphState:
    state: AgentGraphState = dict(initial_state)  # type: ignore[assignment]

    for node in (
        _graph_analyze,
        _graph_retrieve,
        _graph_prepare_context,
        _graph_compose_answer,
        _graph_queue_learning,
    ):
        node_result = cast(AgentGraphState, node(state))
        state.update(node_result)

    state["graph_engine"] = engine
    state["graph_error"] = _LANGGRAPH_ERROR
    return state

def _run_agent_orchestrator(initial_state: AgentGraphState):
    app = _build_langgraph_app()

    if app is None:
        return _run_graph_nodes_sequentially(initial_state)

    try:
        result = app.invoke(dict(initial_state))
        result["graph_engine"] = "langgraph"
        result["graph_error"] = None
        return result
    except Exception as err:
        global _LANGGRAPH_ERROR
        _LANGGRAPH_ERROR = str(err)
        return _run_graph_nodes_sequentially(initial_state, engine="sequential_fallback_after_langgraph_error")


def agent_status():
    app = _build_langgraph_app()
    return {
        "orchestrator": "langgraph" if app is not None else "sequential_fallback",
        "langgraph_available": app is not None,
        "fallback_reason": _LANGGRAPH_ERROR,
    }


def build_chat_response(request: ChatRequest, authorization=None):
    settings = get_settings()
    conversation_id = history_store.get_or_create_conversation_id(request.conversation_id)
    backend_history = history_store.get_history(conversation_id)
    frontend_history = _history_from_request_context(request.context, request.message)
    previous_history = frontend_history or backend_history
    history_store.append_message(conversation_id, "user", request.message)

    graph_state = _run_agent_orchestrator({
        "request": request,
        "authorization": authorization,
        "previous_history": previous_history,
    })

    intent = cast(IntentResult | None, graph_state.get("intent"))
    if intent is None:
        raise RuntimeError("AgentGraphState missing 'intent' after orchestrator execution.")

    sources = cast(list[RagSource], graph_state.get("sources", []))
    tool_calls = cast(list[ToolCall], graph_state.get("tool_calls", []))
    requires_confirmation = graph_state.get("requires_confirmation", False)
    answer = graph_state.get("answer", "")
    orchestrator = graph_state.get("orchestrator", intent.kind)

    answer_parts = [answer]

    if settings.include_debug_sections_in_answer and (tool_calls or intent.kind != "memory"):
        answer_parts.append(_format_tools(tool_calls))

    if settings.include_debug_sections_in_answer and sources:
        answer_parts.append(_format_sources(sources))
    elif settings.include_debug_sections_in_answer and intent.kind != "memory":
        answer_parts.append(_format_sources(sources))

    if requires_confirmation and intent.kind != "app_action":
        action_summaries = [
            tool.output_summary
            for tool in tool_calls
            if tool.data and tool.data.get("requires_confirmation")
        ]

        if action_summaries:
            answer_parts.append(
                "Borrador de accion pendiente de confirmacion:\n"
                + "\n\n".join(action_summaries)
            )
        else:
            answer_parts.append(
                "Accion pendiente de confirmacion: la IA puede preparar datos, pero el usuario debe confirmar "
                "antes de ejecutar cambios sobre animales, corrales, estados, tratamientos o bajas."
            )

    if settings.include_safety_notice_in_answer:
        answer_parts.append(SAFETY_NOTICE)

    final_answer = "\n\n".join(answer_parts)
    history_store.append_message(conversation_id, "assistant", final_answer)

    tool_calls.append(ToolCall(
        name="orquestador",
        status="ok",
        input={
            "mode": orchestrator,
            "intent": intent.kind,
            "engine": graph_state.get("graph_engine"),
            "fallback_reason": graph_state.get("graph_error"),
        },
        output_summary=(
            f"Respuesta generada con {orchestrator} "
            f"via {graph_state.get('graph_engine')}."
        )
    ))

    return ChatResponse(
        conversation_id=conversation_id,
        answer=final_answer,
        sources=sources,
        tool_calls=tool_calls,
        requires_confirmation=requires_confirmation,
        safety_notice=SAFETY_NOTICE
    )
