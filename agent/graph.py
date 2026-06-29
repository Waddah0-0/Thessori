from typing import TypedDict

from langgraph.graph import StateGraph, END

from agent.nodes import (
    expand_queries,
    fetch_papers,
    rank_papers,
    summarize_papers,
    analyze_gaps,
    generate_report,
)


class ResearchState(TypedDict):
    session_id: str
    queries: list[str]
    original_queries: list[str]
    use_ai_expansion: bool
    max_papers: int
    top_k_papers: int
    raw_papers: list[dict]
    approved_papers: list[dict]
    summaries: list[dict]
    gap_analysis: str
    deep_dive_queries: list[str]
    markdown_report: str
    status: str
    error: str | None


def build_graph() -> StateGraph:
    """Phase-1 graph: fetch papers, then rank them, then stop.

    The graph deliberately ends after ranking so the web UI can present the
    human-in-the-loop approval checkpoint. The downstream nodes live only in
    build_resume_graph() — keeping them out here avoids any reliance on
    unreachable-node tolerance and makes the pause point explicit.
    """
    graph = StateGraph(ResearchState)
    graph.add_node("expand_queries", expand_queries)
    graph.add_node("fetch_papers", fetch_papers)
    graph.add_node("rank_papers", rank_papers)
    graph.set_entry_point("expand_queries")
    graph.add_edge("expand_queries", "fetch_papers")
    graph.add_edge("fetch_papers", "rank_papers")
    graph.add_edge("rank_papers", END)  # ← pause for human approval
    return graph.compile()


def build_resume_graph() -> StateGraph:
    """Phase-2 graph: resumes after the user approves a subset of papers."""
    graph = StateGraph(ResearchState)
    graph.add_node("summarize_papers", summarize_papers)
    graph.add_node("analyze_gaps", analyze_gaps)
    graph.add_node("generate_report", generate_report)
    graph.set_entry_point("summarize_papers")
    graph.add_edge("summarize_papers", "analyze_gaps")
    graph.add_edge("analyze_gaps", "generate_report")
    graph.add_edge("generate_report", END)
    return graph.compile()
