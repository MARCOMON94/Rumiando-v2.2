from typing import Any, TypedDict

from app.schemas import ChatRequest, ChatResponse, ToolCall
from app.services import history_store
from app.services.rag_service import search_documents
from app.services.tools import run_app_tools


SAFETY_NOTICE = (
    "La IA de RumiAndo ayuda a interpretar informacion ganadera, pero no sustituye "
    "el criterio de un veterinario ni ejecuta acciones sin confirmacion del usuario."
)


class AgentState(TypedDict, total=False):
    message: str
    authorization: str | None
    sources: list[Any]
    tool_calls: list[Any]


def _run_sequential(message, authorization=None):
    return {
        "sources": search_documents(message),
        "tool_calls": run_app_tools(message, authorization)
    }


def _run_langgraph_if_available(message, authorization=None):
    try:
        from langgraph.graph import END, StateGraph
    except Exception:
        return None

    def retrieve_node(state):
        return {
            **state,
            "sources": search_documents(state["message"])
        }

    def tools_node(state):
        return {
            **state,
            "tool_calls": run_app_tools(state["message"], state.get("authorization"))
        }

    graph = StateGraph(AgentState)
    graph.add_node("retrieve_documents", retrieve_node)
    graph.add_node("run_app_tools", tools_node)
    graph.set_entry_point("retrieve_documents")
    graph.add_edge("retrieve_documents", "run_app_tools")
    graph.add_edge("run_app_tools", END)

    compiled = graph.compile()
    return compiled.invoke({"message": message, "authorization": authorization})


def _format_sources(sources):
    if not sources:
        return (
            "No tengo aun documentos RAG de dominio cargados para citar. "
            "Cuando añadas los markdown a `ai-service/knowledge/`, usare esas fuentes."
        )

    lines = []
    for index, source in enumerate(sources, start=1):
        lines.append(f"[{index}] {source.title} ({source.file})")
    return "Fuentes consultadas:\n" + "\n".join(lines)


def _format_tools(tool_calls):
    if not tool_calls:
        return "No he necesitado consultar datos vivos de la app para esta respuesta."

    return "\n".join(
        f"{tool.name}: {tool.output_summary}"
        for tool in tool_calls
    )


def _is_action_request(message):
    normalized = message.lower()
    action_words = [
        "crea", "crear", "mueve", "mover", "traslada", "trasladar",
        "borra", "borrar", "actualiza", "actualizar", "registra", "registrar"
    ]
    return any(word in normalized for word in action_words)


def build_chat_response(request: ChatRequest, authorization=None):
    conversation_id = history_store.get_or_create_conversation_id(request.conversation_id)
    history_store.append_message(conversation_id, "user", request.message)

    state = _run_langgraph_if_available(request.message, authorization)
    orchestrator = "LangGraph"
    if state is None:
        state = _run_sequential(request.message, authorization)
        orchestrator = "flujo local"

    sources = state.get("sources", [])
    tool_calls = state.get("tool_calls", [])
    requires_confirmation = _is_action_request(request.message) or any(
        tool.data and tool.data.get("requires_confirmation")
        for tool in tool_calls
    )

    answer_parts = [
        f"He procesado la consulta con {orchestrator}.",
        _format_tools(tool_calls),
        _format_sources(sources)
    ]

    if requires_confirmation:
        answer_parts.append(
            "Si la consulta implica crear, mover, borrar o actualizar datos, deja la accion preparada "
            "y confirma manualmente desde la pantalla correspondiente."
        )

    answer_parts.append(SAFETY_NOTICE)

    answer = "\n\n".join(answer_parts)
    history_store.append_message(conversation_id, "assistant", answer)

    tool_calls.append(ToolCall(
        name="orquestador",
        status="ok",
        input={"mode": orchestrator},
        output_summary=f"Respuesta generada con {orchestrator}."
    ))

    return ChatResponse(
        conversation_id=conversation_id,
        answer=answer,
        sources=sources,
        tool_calls=tool_calls,
        requires_confirmation=requires_confirmation,
        safety_notice=SAFETY_NOTICE
    )

