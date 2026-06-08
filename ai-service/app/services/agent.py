import unicodedata

from app.config import get_settings
from app.schemas import ChatRequest, ChatResponse, ToolCall
from app.services import history_store
from app.services.intent_service import classify_intent
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


def _run_sequential(message, search_query, intent, authorization=None):
    run_tools = intent.kind in {"app_query", "app_action"}
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
    return any(keyword in normalized for keyword in keywords)


def _priority_label(priority):
    labels = {
        "URGENT": "urgencia veterinaria",
        "HIGH": "prioridad alta",
        "MEDIUM": "prioridad media",
        "LOW": "prioridad baja"
    }
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

        if "me ha pisado" in normalized or "me piso" in normalized or "pisado una oveja" in normalized:
            return (
                "Si te ha pisado a ti: revisa si puedes apoyar, si hay deformidad, herida, hinchazon fuerte "
                "o dolor intenso. Si no puedes apoyar, hay deformidad o la piel esta abierta, ve a urgencias.\n\n"
                "Si le ha pisado a otro animal: separalo, no lo fuerces a caminar y llama al veterinario si "
                "cojea, no apoya, sangra o esta decaido."
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

    actions = "\n".join(
        f"- {item}"
        for item in triage.immediate_actions[:3]
    )
    do_not = "\n".join(f"- {item}" for item in triage.do_not[:2])
    priority = "URGENTE: llama al veterinario ya." if triage.priority == "URGENT" else f"Prioridad: {_priority_label(triage.priority)}."

    return (
        f"{priority}\n\n"
        f"{triage.title}. No lo cierro como diagnostico, pero no lo dejaria pasar.\n\n"
        f"Haz ahora:\n{actions}\n\n"
        f"No hagas:\n{do_not}\n\n"
        f"{triage.vet_when}"
    )


def _build_memory_answer(history):
    user_messages = [
        message.content.strip()
        for message in history
        if message.role == "user" and message.content.strip()
    ]

    if not user_messages:
        return (
            "En esta conversacion todavia no tengo preguntas anteriores guardadas. "
            "A partir de ahora puedo usar este hilo para mantener contexto."
        )

    recent = user_messages[-6:]
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


def _build_app_query_answer(tool_calls, sources):
    if any(tool.status == "ok" for tool in tool_calls):
        return "He consultado los datos disponibles de la app y te dejo el resultado preparado abajo."

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


def _should_try_unknown_llm_fallback(intent, triage, sources):
    if intent.kind == "general":
        return True

    if intent.kind == "veterinary" and triage.code == "generic_health":
        return True

    if intent.kind == "veterinary" and not sources:
        return True

    return False


def _should_queue_for_review(intent, triage, answer_from_unknown_fallback=False):
    return (
        answer_from_unknown_fallback
        or intent.kind == "general"
        or triage.code == "generic_health"
    )


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
    "sangre", "sale sangre", "lo intente", "le pincho",

    "golpe", "coche", "atropello", "atropellado", "atropellada",
    "fue del golpe", "creo que fue", "le di", "le he dado",
    "accidente", "trauma",

    "pario", "parida", "cria", "crias", "madre", "calostro",
    "no mama", "no ha mamado", "no se cual es la madre"
]
    return normalized.startswith(followup_starts) or any(term in normalized for term in context_terms)


def _recent_user_context(history, limit=3):
    messages = [
        message.content.strip()
        for message in history
        if message.role == "user" and message.content.strip()
    ]
    return "\n".join(messages[-limit:])


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


def _build_local_answer(message, sources, tool_calls, triage, intent):
    if intent.kind == "veterinary" or triage.is_relevant or _is_health_or_symptom_query(message):
        return _build_triage_answer(message, triage, sources)

    if intent.kind == "management" or _is_management_or_cohabitation_question(message):
        return _build_management_answer(message)

    if any(tool.name == "preparar_cambio_corral" for tool in tool_calls):
        return (
            "He detectado una intencion de cambio de corral.\n\n"
            "Puedo preparar el borrador con animales leidos por crotal/RFID, corral destino, "
            "origen actual y posibles duplicados. La ruta definitiva de ejecucion queda pendiente, "
            "asi que de momento debe confirmarse en el flujo de movimientos.\n\n"
            "Datos que necesito: crotales o lectura RFID, corral destino y fecha del movimiento."
        )

    if intent.kind == "app_query":
        return _build_app_query_answer(tool_calls, sources)

    return (
        "No tengo una respuesta fiable con la base actual. Lo dejo marcado para revisar y añadir "
        "a la biblioteca RAG si es una pregunta real de campo.\n\n"
        "Mientras tanto, si hay dolor fuerte, sangre, dificultad para respirar, no se levanta, "
        "parto atascado, intoxicacion o empeora rapido, llama al veterinario."
    )


def build_chat_response(request: ChatRequest, authorization=None):
    settings = get_settings()
    conversation_id = history_store.get_or_create_conversation_id(request.conversation_id)
    previous_history = history_store.get_history(conversation_id)
    history_store.append_message(conversation_id, "user", request.message)

    context = _recent_user_context(previous_history) if _should_use_context(request.message) else None
    triage = classify_triage(request.message, context=context)
    intent = classify_intent(request.message, triage)
    search_query = intent.search_query or triage.suggested_rag_query or request.message

    if intent.kind == "memory":
        state = {"sources": [], "tool_calls": []}
        orchestrator = "memoria local"
    else:
        state = _run_sequential(request.message, search_query, intent, authorization)
        orchestrator = f"{intent.kind}: {intent.reason}"

    sources = _dedupe_sources_by_file(state.get("sources", []))
    tool_calls = state.get("tool_calls", [])
    requires_confirmation = intent.requires_confirmation or any(
        tool.data and tool.data.get("requires_confirmation")
        for tool in tool_calls
    )

    context_answer = _build_context_followup_answer(request.message, context)
    human_exposure = _is_human_exposure_question(request.message, context=context)

    if intent.kind == "memory":
        answer = _build_memory_answer(previous_history)
    elif context_answer:
        answer = context_answer
    elif human_exposure:
        answer = _build_human_exposure_answer()
    else:
        answer = build_llm_answer(
            request.message,
            sources,
            tool_calls,
            requires_confirmation=requires_confirmation,
            history=previous_history,
            triage=triage,
            intent=intent
        )

    answer_from_unknown_fallback = False
    if not answer and _should_try_unknown_llm_fallback(intent, triage, sources):
        answer = build_llm_answer(
            request.message,
            sources,
            tool_calls,
            requires_confirmation=requires_confirmation,
            history=previous_history,
            triage=triage,
            intent=intent,
            force=True
        )
        answer_from_unknown_fallback = bool(answer)

    if not answer:
        answer = _build_local_answer(request.message, sources, tool_calls, triage, intent)

    if _should_queue_for_review(intent, triage, answer_from_unknown_fallback):
        add_unresolved_question(
            message=request.message,
            conversation_id=conversation_id,
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

    answer_parts = [answer]

    if settings.include_debug_sections_in_answer and (tool_calls or intent.kind != "memory"):
        answer_parts.append(_format_tools(tool_calls))

    if settings.include_debug_sections_in_answer and sources:
        answer_parts.append(_format_sources(sources))
    elif settings.include_debug_sections_in_answer and intent.kind != "memory":
        answer_parts.append(_format_sources(sources))

    if requires_confirmation:
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
        input={"mode": orchestrator, "intent": intent.kind},
        output_summary=f"Respuesta generada con {orchestrator}."
    ))

    return ChatResponse(
        conversation_id=conversation_id,
        answer=final_answer,
        sources=sources,
        tool_calls=tool_calls,
        requires_confirmation=requires_confirmation,
        safety_notice=SAFETY_NOTICE
    )
