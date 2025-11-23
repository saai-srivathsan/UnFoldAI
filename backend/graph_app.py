from langgraph.graph import StateGraph, END
from state import AgentState
from nodes import conversation_agent
from research_node import research_agent

graph = StateGraph(AgentState)

graph.add_node("conversation", conversation_agent)
graph.add_node("research", research_agent)

def next_after_conversation(state: AgentState) -> str:
    if state.get("research_needed"):
        return "research"
    return END

graph.set_entry_point("conversation")

graph.add_conditional_edges(
    "conversation",
    next_after_conversation,
    {
        "research": "research",
        END: END,
    },
)

graph.add_edge("research", "conversation")

app = graph.compile()   # this is the LangGraph app
