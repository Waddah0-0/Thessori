import os
import json
import uuid
import tempfile

from datetime import datetime

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from agent.graph import build_graph, build_resume_graph


load_dotenv()

app = FastAPI(title="Thessori")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS_FILE = os.path.join("output", "sessions.json")


def _load_sessions() -> dict[str, dict]:
    try:
        with open(SESSIONS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _save_sessions() -> None:
    try:
        os.makedirs("output", exist_ok=True)
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(sessions, f)
    except OSError:
        pass


sessions: dict[str, dict] = _load_sessions()


def _friendly_error(exc: Exception) -> str:
    """Turn a raw backend exception into a message that helps the user act."""
    text = str(exc).lower()
    if any(k in text for k in ("api_key", "apikey", "authentication", "401", "invalid key", "unauthorized")):
        return "Qwen API authentication failed — check that QWEN_API_KEY in your .env is set and valid."
    if any(k in text for k in ("rate limit", "429", "quota")):
        return "The Qwen API is rate-limiting requests right now. Wait a moment and try again."
    if any(k in text for k in ("timeout", "timed out", "connection", "getaddrinfo", "network")):
        return "Couldn't reach the Qwen API — check your network connection and QWEN_BASE_URL."
    return f"Something went wrong while running the agent: {exc}"


class QueryRequest(BaseModel):
    queries: list[str]  # one or more research queries
    use_ai_expansion: bool = True
    max_papers: int | None = None
    top_k_papers: int | None = None


class ApprovalRequest(BaseModel):
    session_id: str
    approved_indices: list[int]


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[dict] = []  


class DeepDiveRequest(BaseModel):
    session_id: str


@app.post("/api/start")
async def start_research(req: QueryRequest):
    """Start the pipeline. Returns a session_id and the ranked papers for review."""
    session_id = str(uuid.uuid4())
    initial_state = {
        "session_id": session_id,
        "queries": req.queries,
        "original_queries": req.queries,
        "use_ai_expansion": req.use_ai_expansion,
        "max_papers": req.max_papers if req.max_papers is not None else int(os.environ.get("MAX_PAPERS", 20)),
        "top_k_papers": req.top_k_papers if req.top_k_papers is not None else int(os.environ.get("TOP_K_PAPERS", 10)),
        "status": "starting",
        "error": None,
        "timestamp": datetime.now().isoformat()
    }

    graph = build_graph()
    try:
        final_state = await graph.ainvoke(initial_state)
    except Exception as e:
        return JSONResponse({"error": _friendly_error(e)}, status_code=500)

    if not final_state.get("raw_papers"):
        return JSONResponse(
            {
                "error": "No papers found for those queries. Try rephrasing, broadening "
                "the topic, or adding an S2_API_KEY in .env for more sources."
            },
            status_code=200,
        )

    sessions[session_id] = final_state
    _save_sessions()
    return JSONResponse(
        {
            "session_id": session_id,
            "papers": final_state["raw_papers"],
            "status": final_state["status"],
            "queries": final_state.get("queries", []),
            "original_queries": final_state.get("original_queries", []),
        }
    )


@app.post("/api/approve")
async def approve_papers(req: ApprovalRequest):
    """Resume the pipeline after the user approves papers. Returns full markdown."""
    state = sessions.get(req.session_id)
    if not state:
        return JSONResponse({"error": "Session not found"}, status_code=404)

    approved = [
        state["raw_papers"][i]
        for i in req.approved_indices
        if 0 <= i < len(state["raw_papers"])
    ]
    state["approved_papers"] = approved
    state["status"] = "resuming"

    from agent.progress import clear_progress

    resume_graph = build_resume_graph()
    try:
        final_state = await resume_graph.ainvoke(state)
    except Exception as e:
        clear_progress(req.session_id)
        return JSONResponse({"error": _friendly_error(e)}, status_code=500)

    sessions[req.session_id] = final_state
    _save_sessions()
    clear_progress(req.session_id)

    return JSONResponse(
        {
            "status": final_state["status"],
            "markdown": final_state.get("markdown_report", ""),
        }
    )


@app.get("/api/progress/{session_id}")
async def get_progress(session_id: str):
    """Return the current pipeline stage + detail message for the session.

    `stage` is a PipelineStatus key so the frontend's checkpoint line can
    advance live; `detail` is the fine-grained status text shown below it.
    """
    from agent.progress import progress_store

    data = progress_store.get(session_id) or {
        "stage": "papers_summarized",
        "detail": "Processing...",
        "current_index": -1,
        "action": "",
    }
    return JSONResponse(data)


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    """Rehydrate a session after a page refresh (used by the frontend on load)."""
    state = sessions.get(session_id)
    if not state:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return JSONResponse(
        {
            "status": state.get("status", ""),
            "papers": state.get("raw_papers", []),
            "markdown": state.get("markdown_report", ""),
            "queries": state.get("queries", []),
            "original_queries": state.get("original_queries", []),
        }
    )


@app.get("/api/history")
async def get_history():
    """Return a list of all research sessions, sorted by timestamp (newest first)."""
    history_list = []
    for sid, state in sessions.items():
        history_list.append({
            "session_id": sid,
            "queries": state.get("original_queries") or state.get("queries") or [],
            "status": state.get("status", "unknown"),
            "timestamp": state.get("timestamp"),
            "papers_count": len(state.get("raw_papers") or []),
            "has_report": bool(state.get("markdown_report")),
        })
    try:
        history_list.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    except Exception:
        pass
    return JSONResponse(history_list)


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session from history."""
    if session_id in sessions:
        del sessions[session_id]
        _save_sessions()
        return JSONResponse({"status": "deleted"})
    return JSONResponse({"error": "Session not found"}, status_code=404)



@app.post("/api/chat")
async def chat_with_report(req: ChatRequest):
    """Answer a user's question strictly based on the generated literature review."""
    state = sessions.get(req.session_id)
    if not state or not state.get("markdown_report"):
        return JSONResponse({"error": "Report not found"}, status_code=404)

    from agent.nodes import _qwen_client

    client = _qwen_client()
    model = os.environ["QWEN_MODEL"]

    system_prompt = (
        "You are Thessori, an AI research agent. Answer the user's questions based on the "
        "literature review report below, taking the prior conversation into account. "
        "If the answer is not contained in the report, say so plainly and do not invent information.\n"
        "If the user asks you to 'make queries' or run a new search, you MUST append a raw JSON block "
        "to the end of your message in this exact format:\n"
        '```json\n{"agent_action": "search", "queries": ["query 1", "query 2"]}\n```\n'
        "Use a distinct string per direction the user implies. The frontend parses this to start the search.\n\n"
        f"--- LITERATURE REVIEW ---\n{state['markdown_report']}\n-------------------------"
    )

    # Carry a bounded window of prior turns so the assistant has memory.
    history_msgs = [
        {"role": m["role"], "content": m["content"]}
        for m in req.history[-8:]
        if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
    ]
    messages = (
        [{"role": "system", "content": system_prompt}]
        + history_msgs
        + [{"role": "user", "content": req.message}]
    )

    async def token_stream():
        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=500,
                stream=True,
            )
            async for chunk in stream:
                choices = getattr(chunk, "choices", None)
                if not choices:
                    continue
                delta = choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            yield f"\n\n[Error: {_friendly_error(e)}]"

    return StreamingResponse(token_stream(), media_type="text/plain; charset=utf-8")


@app.post("/api/deepdive")
async def deep_dive(req: DeepDiveRequest):
    """Return the follow-up queries already embedded in the report's gap analysis.

    `analyze_gaps` makes the model append a "Suggested Deep Dive Queries" list
    to the gap analysis, so this is a deterministic parse — no extra LLM call.
    """
    state = sessions.get(req.session_id)
    if not state or not state.get("gap_analysis"):
        return JSONResponse({"error": "Gap analysis not found"}, status_code=404)

    queries = [q for q in (state.get("deep_dive_queries") or []) if isinstance(q, str) and q.strip()]
    if not queries:
        from agent.report import extract_deep_dive_queries

        queries = extract_deep_dive_queries(state["gap_analysis"])

    if not queries:
        return JSONResponse(
            {"error": "No deep-dive queries were found in this report."},
            status_code=404,
        )
    return JSONResponse({"queries": queries[:3]})


@app.get("/api/export/{session_id}")
async def export_report(
    session_id: str,
    format: str = Query(..., pattern="^(markdown|latex|pdf|gdoc)$"),
):
    """Export the report in the requested format (called by the export buttons)."""
    state = sessions.get(session_id)
    if not state or not state.get("markdown_report"):
        return JSONResponse({"error": "Report not ready"}, status_code=404)

    markdown = state["markdown_report"]
    queries = state["queries"]

    if format == "markdown":
        return Response(
            content=markdown,
            media_type="text/markdown",
            headers={"Content-Disposition": "attachment; filename=literature_review.md"},
        )

    if format == "latex":
        from agent.report import markdown_to_latex

        latex = markdown_to_latex(markdown, queries)
        return Response(
            content=latex,
            media_type="application/x-tex",
            headers={"Content-Disposition": "attachment; filename=literature_review.tex"},
        )

    if format == "pdf":
        from agent.report import markdown_to_latex
        import subprocess

        latex = markdown_to_latex(markdown, queries)
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                tex_path = os.path.join(tmpdir, "report.tex")
                pdf_path = os.path.join(tmpdir, "report.pdf")
                with open(tex_path, "w", encoding="utf-8") as f:
                    f.write(latex)
                subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", tex_path],
                    cwd=tmpdir,
                    capture_output=True,
                    check=True,
                )
                with open(pdf_path, "rb") as f:
                    pdf_bytes = f.read()
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": "attachment; filename=literature_review.pdf"},
            )
        except (FileNotFoundError, subprocess.CalledProcessError, OSError):
            return JSONResponse(
                {
                    "error": "PDF export needs a LaTeX engine (pdflatex) on the server. "
                    "Download the LaTeX (.tex) file and compile it in Overleaf, "
                    "or export Markdown instead."
                },
                status_code=501,
            )

    if format == "gdoc":
        return JSONResponse({"url": "https://docs.google.com/stub"})


if os.path.isdir("ui_dist"):
    app.mount("/", StaticFiles(directory="ui_dist", html=True), name="ui")
else:

    @app.get("/")
    async def root():
        return JSONResponse(
            {
                "message": "Thessori API is running. The frontend isn't built yet — "
                "use the Vite dev server at http://localhost:5173, or run "
                "`npm run build` to serve the UI from here."
            }
        )
