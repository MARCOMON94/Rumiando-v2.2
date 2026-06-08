from app.config import get_settings
from app.services.privacy import redact_sensitive_text


SYSTEM_PROMPT = """
Eres el asistente IA de RumiAndo, una app de gestion ganadera para ovino y caprino.

Objetivo:
- Responder de forma practica, clara, directa y breve.
- Usar fuentes RAG cuando existan, sin limitarte a listarlas.
- Usar datos vivos de la app cuando las tools los hayan consultado.
- No diagnosticar de forma cerrada.
- No recetar medicamentos, dosis, antibioticos, antiinflamatorios ni tratamientos invasivos.
- Recomendar veterinario cuando haya urgencia o signos graves.
- Si faltan datos importantes, pedir solo los imprescindibles.
- Si hay riesgo vital, dar primeros pasos seguros inmediatamente antes de pedir mas informacion.
- Si el triaje local marca URGENT o HIGH, respetar esa prioridad y no suavizarla.
- Si el usuario pregunta por lo hablado antes, usar el historial de conversacion.
- No meter categorias largas en la primera frase. Di primero lo que tiene que hacer.
- No incluyas fuentes consultadas ni tools en el texto: ya se mandan como campos estructurados.
- Responder al hecho concreto, no a toda la familia de riesgo. Si el usuario dice "he pisado un perro",
  habla de pisoton y cojera, no de atropellos, cornadas o heridas no mencionadas.
- No empieces con "necesito mas detalles" si ya hay una actuacion segura evidente.
- Si hay datos de tools internas, usa esos datos directamente. No digas que no tienes acceso.
- Evita sonar como una ficha tecnica. Respuesta practica de campo: clara, corta y situada.

Sanidad animal:
- Prioriza triaje: urgencia alta, media o baja.
- Indica acciones seguras: aislar, observar respiracion, postura, mucosas, heridas,
  abdomen, apetito, agua, temperatura si se puede, parto, diarrea y secreciones.
- Si hay sangrado abundante, dificultad respiratoria, animal tumbado que no se levanta,
  timpanismo, parto bloqueado, intoxicacion, fiebre alta, shock o dolor intenso:
  urgencia veterinaria.

Acciones en la app:
- Cambio de corral puede prepararse como borrador accionable.
- La ejecucion final de rutas definitivas queda pendiente salvo que una tool segura lo confirme.
- Nunca digas que has ejecutado un movimiento, baja, tratamiento o cambio de estado si solo esta preparado.

Formato recomendado:
- En urgencias: primera frase "URGENTE: llama al veterinario ya." o equivalente.
- Despues 2-4 frases o bullets maximo.
- Si el caso implica parto bloqueado, pata arrancada, atropello, convulsion, falta de aire,
  intoxicacion o sangrado abundante, no pidas mas datos antes de dar la actuacion inmediata.
- Puedes decir que el veterinario valorara medicacion necesaria, pero no prescribas farmacos ni dosis.
- Si el caso no es urgente, dilo: "Si esta normal, no parece urgencia", y luego 2-4 cosas a revisar.
"""


def _format_sources_for_prompt(sources):
    if not sources:
        return "No hay fuentes RAG recuperadas."

    blocks = []
    for index, source in enumerate(sources, start=1):
        blocks.append(
            f"[{index}] {source.title}\n"
            f"Archivo: {source.file}\n"
            f"Fragmento:\n{source.excerpt}"
        )

    return "\n\n".join(blocks)


def _format_tools_for_prompt(tool_calls):
    if not tool_calls:
        return "No se han ejecutado tools de datos vivos."

    blocks = []
    for index, tool in enumerate(tool_calls, start=1):
        blocks.append(
            f"[{index}] Tool: {tool.name}\n"
            f"Estado: {tool.status}\n"
            f"Resumen: {tool.output_summary}"
        )

    return "\n\n".join(blocks)


def _format_history_for_prompt(history):
    if not history:
        return "No hay historial anterior."

    lines = []
    for item in history[-10:]:
        content = redact_sensitive_text(item.content).replace("\n", " ").strip()
        if len(content) > 500:
            content = content[:500] + "..."
        lines.append(f"{item.role}: {content}")

    return "\n".join(lines)


def build_llm_answer(
    message,
    sources,
    tool_calls,
    requires_confirmation=False,
    history=None,
    triage=None,
    intent=None,
    force=False
):
    settings = get_settings()

    can_use_fallback = force and settings.openai_fallback_on_unknown
    if not (settings.use_llm or can_use_fallback) or not settings.openai_api_key:
        return None

    try:
        import importlib

        OpenAI = importlib.import_module("openai").OpenAI
        client = OpenAI(api_key=settings.openai_api_key)
        safe_message = redact_sensitive_text(message)

        response = client.responses.create(
            model=settings.openai_model,
            instructions=SYSTEM_PROMPT,
            input=(
                "Mensaje del usuario:\n"
                f"{safe_message}\n\n"
                "Historial reciente de esta conversacion:\n"
                f"{_format_history_for_prompt(history or [])}\n\n"
                "Triaje local previo sin coste:\n"
                f"{triage.as_prompt_block() if triage else 'No hay triaje local.'}\n\n"
                "Perfil interno seleccionado:\n"
                f"{intent.kind if intent else 'general'}"
                f" ({intent.reason if intent else 'sin clasificacion especifica'})\n\n"
                "Fuentes RAG recuperadas:\n"
                f"{_format_sources_for_prompt(sources)}\n\n"
                "Resultados de tools internas:\n"
                f"{_format_tools_for_prompt(tool_calls)}\n\n"
                f"requires_confirmation: {requires_confirmation}\n\n"
                "Redacta la mejor respuesta final para el usuario. "
                "No digas 'he procesado la consulta'. "
                "Si no hay fuentes suficientes, dilo de forma honesta pero da una orientacion segura. "
                "Si una tool no encontro animales, no lo conviertas en el centro salvo "
                "que el usuario haya pedido buscar un animal concreto."
            ),
            max_output_tokens=settings.openai_max_output_tokens,
            store=settings.openai_store
        )

        return getattr(response, "output_text", None)

    except Exception as err:
        if settings.environment == "development":
            print(f"[LLM ERROR] {type(err).__name__}: {err}")
        return None


def build_learning_case_summary(message_redacted, triage=None, intent=None):
    settings = get_settings()

    if not settings.learning_use_openai_reformulation or not settings.openai_api_key:
        return None

    try:
        import importlib

        OpenAI = importlib.import_module("openai").OpenAI
        client = OpenAI(api_key=settings.openai_api_key)

        response = client.responses.create(
            model=settings.openai_model,
            instructions=(
                "Convierte una consulta ganadera ya anonimizada en un resumen generico "
                "para una cola de mejora de base de conocimiento. No incluyas nombres, "
                "relaciones familiares, usuarios, explotaciones, ubicaciones ni identificadores. "
                "No juzgues. Devuelve solo JSON."
            ),
            input=(
                f"Consulta anonimizada: {message_redacted}\n"
                f"Intent: {getattr(intent, 'kind', 'unknown')}\n"
                f"Triage code: {getattr(triage, 'code', 'general')}\n"
                f"Priority: {getattr(triage, 'priority', 'LOW')}\n\n"
                "Devuelve JSON con estas claves: "
                "case_title, case_summary, knowledge_gap, suggested_tags."
            ),
            max_output_tokens=min(settings.openai_max_output_tokens, 250),
            store=settings.openai_store
        )

        return getattr(response, "output_text", None)

    except Exception as err:
        if settings.environment == "development":
            print(f"[LEARNING SUMMARY ERROR] {type(err).__name__}: {err}")
        return None
