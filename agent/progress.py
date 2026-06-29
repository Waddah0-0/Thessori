# In-memory progress tracker for the long-running phase-2 (resume) pipeline.
# Maps session_id -> {"stage": <pill key>, "detail": <human-readable message>}.
#
# `stage` is one of the PipelineStatus keys the frontend knows about
# ("papers_summarized", "gaps_analyzed", "complete") so the horizontal
# checkpoint line can advance live. `detail` is the fine-grained message
# (e.g. "Downloading PDF 2 of 5...") shown beneath the checkpoints.
progress_store: dict[str, dict] = {}


def set_progress(session_id: str, stage: str, detail: str) -> None:
    progress_store[session_id] = {"stage": stage, "detail": detail}


def clear_progress(session_id: str) -> None:
    progress_store.pop(session_id, None)
