import os
import asyncio
import json
import re
import io
import httpx
from pypdf import PdfReader
from agent.progress import set_progress

# pyrefly: ignore [missing-import]
from openai import AsyncOpenAI

from agent.tools import fetch_arxiv, fetch_semantic_scholar


def _qwen_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ["QWEN_API_KEY"],
        base_url=os.environ["QWEN_BASE_URL"],
    )


def _smart_pdf_context(full_text: str, budget: int = 28000) -> str:
    """Turn raw PDF text into a compact, summary-ready context window."""
    text = re.sub(r"[ \t]+", " ", full_text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) <= budget:
        return text
    head = int(budget * 0.7)
    tail = budget - head
    return text[:head] + "\n\n[... middle omitted ...]\n\n" + text[-tail:]


async def expand_queries(state: dict) -> dict:
    """Node 0: Expand user queries into highly specific academic search terms."""
    if not state.get("use_ai_expansion", True):
        return {"status": "queries_expanded_skipped"}

    client = _qwen_client()
    model = os.environ["QWEN_MODEL"]
    
    prompt = (
        "Act as an expert academic researcher. The user wants to research the following topics: "
        f"{'; '.join(state['queries'])}\n\n"
        "Generate exactly 3 highly specific, academic search queries that will yield the best literature review results. "
        "Return ONLY a JSON array of strings. Example: [\"temporal attention mechanisms\", \"transformer time series forecasting\"]"
    )
    
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
        )
        raw = response.choices[0].message.content
        expanded = json.loads(re.search(r"\[.*?\]", raw, re.DOTALL).group())
        if not isinstance(expanded, list) or not expanded:
            raise ValueError("Invalid array")
        expanded = [str(q).strip() for q in expanded if str(q).strip()]
        return {"queries": expanded, "status": "queries_expanded"}
    except Exception:
        # Fallback to original queries if the model fails or parsing breaks
        return {"status": "queries_expansion_failed"}


async def fetch_papers(state: dict) -> dict:
    """Node 1: Fetch papers for all queries in parallel, then merge + deduplicate."""
    queries = state["queries"]
    max_papers = state.get("max_papers", int(os.environ.get("MAX_PAPERS", 20)))
    s2_key = os.environ.get("S2_API_KEY", "")

    # One arXiv + one Semantic Scholar call per query, all concurrently.
    tasks = [fetch_arxiv(q, max_papers) for q in queries] + [
        fetch_semantic_scholar(q, max_papers, s2_key) for q in queries
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Flatten all successful batches and deduplicate by normalized title.
    # If a source fails (e.g. Semantic Scholar rate-limiting with a 429), skip
    # that batch — one throttled source must not kill the whole fetch.
    seen: set[str] = set()
    unique: list[dict] = []
    for batch in results:
        if isinstance(batch, BaseException):
            continue
        for paper in batch:
            key = paper["title"].lower().strip()
            if key and key not in seen:
                seen.add(key)
                unique.append(paper)

    return {"raw_papers": unique, "status": "papers_fetched"}


async def rank_papers(state: dict) -> dict:
    """Node 2: Use Qwen to rank papers by relevance and return the top K."""
    top_k = state.get("top_k_papers", int(os.environ.get("TOP_K_PAPERS", 10)))
    client = _qwen_client()
    model = os.environ["QWEN_MODEL"]

    titles_block = "\n".join(
        f"{i}. {p['title']} ({p['year']})" for i, p in enumerate(state["raw_papers"])
    )
    prompt = (
        f"Research queries: {'; '.join(state['queries'])}\n\n"
        f"Papers:\n{titles_block}\n\n"
        f"Return ONLY a JSON array of the {top_k} most relevant paper indices "
        f"(0-based), ordered by relevance. Example: [3, 0, 7, ...]"
    )

    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )
    raw = response.choices[0].message.content

    try:
        indices = json.loads(re.search(r"\[.*?\]", raw, re.DOTALL).group())
        top_papers = [
            state["raw_papers"][i]
            for i in indices
            if isinstance(i, int) and 0 <= i < len(state["raw_papers"])
        ]
        if not top_papers:
            raise ValueError("no valid indices parsed")
    except (AttributeError, ValueError, TypeError, json.JSONDecodeError):
        # Malformed LLM response — fall back to the first top_k in original order
        # so a bad parse can never crash the pipeline.
        top_papers = state["raw_papers"][:top_k]

    return {"raw_papers": top_papers, "status": "awaiting_approval"}
    #  Agent pauses here. The web UI sends approved_papers back to resume.


async def summarize_papers(state: dict) -> dict:
    """Node 3: Summarize each approved paper individually."""
    client = _qwen_client()
    model = os.environ["QWEN_MODEL"]
    summaries = []
    session_id = state.get("session_id", "default")
    
    total = len(state["approved_papers"])
    for i, paper in enumerate(state["approved_papers"]):
        set_progress(session_id, "papers_summarized", f"Processing paper {i+1} of {total}...")

        full_text = ""
        if paper.get("source") == "arxiv" and paper.get("url"):
            try:
                set_progress(session_id, "papers_summarized", f"Downloading PDF {i+1} of {total}...")
                pdf_url = paper["url"].replace("abs", "pdf") + ".pdf"
                async with httpx.AsyncClient(timeout=30) as http_client:
                    pdf_resp = await http_client.get(pdf_url, follow_redirects=True)
                    pdf_resp.raise_for_status()

                set_progress(session_id, "papers_summarized", f"Extracting text from PDF {i+1} of {total}...")
                reader = PdfReader(io.BytesIO(pdf_resp.content))
                text_chunks = [page.extract_text() or "" for page in reader.pages[:25]]
                full_text = _smart_pdf_context("\n".join(text_chunks))
            except Exception as e:
                print(f"Failed to fetch/parse PDF for {paper.get('url')}: {e}")
                full_text = ""

        content_to_summarize = f"Full Text:\n{full_text}" if full_text else f"Abstract:\n{paper['abstract']}"
        set_progress(session_id, "papers_summarized", f"Summarizing paper {i+1} of {total}...")

        prompt = (
            f"Paper title: {paper['title']}\n"
            f"Content provided below:\n\n{content_to_summarize[:30000]}\n\n"
            "Provide a structured summary with these sections based on the content above:\n"
            "1. Core contribution (2 sentences)\n"
            "2. Methodology (2 sentences)\n"
            "3. Key findings (2 sentences)\n"
            "4. Limitations (1 sentence)\n"
        )
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
        )
        summaries.append(
            {
                **paper,
                "summary": response.choices[0].message.content.strip(),
            }
        )

    return {"summaries": summaries, "status": "papers_summarized"}


async def analyze_gaps(state: dict) -> dict:
    """Node 4: Identify research gaps across all summaries."""
    session_id = state.get("session_id", "default")
    set_progress(session_id, "gaps_analyzed", "Analyzing research gaps across all papers...")

    client = _qwen_client()
    model = os.environ["QWEN_MODEL"]

    summaries_block = "\n\n".join(
        f"Paper: {s['title']}\nSummary: {s['summary']}" for s in state["summaries"]
    )
    prompt = (
        f"Research queries: {'; '.join(state['queries'])}\n\n"
        f"Summaries of reviewed papers:\n{summaries_block}\n\n"
        "Based on these papers, identify:\n"
        "1. What problems remain unsolved\n"
        "2. What methodologies are missing\n"
        "3. The most promising future directions\n"
        "Write 3-5 specific paragraphs, citing paper titles where relevant. "
        "Do NOT include any list of search queries inside this prose.\n\n"
        "Then, on the final line only, output exactly this and nothing else:\n"
        'QUERIES_JSON: ["query one", "query two", "query three"]\n'
        "Each query must be a concise standalone academic search phrase (about 4-10 words) "
        "targeting one of the gaps above — not a full sentence or instruction."
    )
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
    )
    content = response.choices[0].message.content.strip()

    # Split the clean prose from the structured query list. Parsing a delimited
    # JSON array is reliable; embedding queries in prose and regexing them back
    # out (the old approach) broke whenever the model reformatted the list.
    gap_text = content
    deep_dive_queries: list[str] = []
    marker = "QUERIES_JSON:"
    if marker in content:
        idx = content.rindex(marker)
        gap_text = content[:idx].strip()
        json_part = content[idx + len(marker):]
        try:
            match = re.search(r"\[.*\]", json_part, re.DOTALL)
            parsed = json.loads(match.group()) if match else []
            deep_dive_queries = [str(q).strip() for q in parsed if str(q).strip()][:3]
        except (AttributeError, ValueError, TypeError, json.JSONDecodeError):
            deep_dive_queries = []

    # Last-resort fallback: if the model ignored the format, recover any list it
    # did write so Deep Dive still has something usable.
    if not deep_dive_queries:
        from agent.report import extract_deep_dive_queries

        deep_dive_queries = extract_deep_dive_queries(content)

    return {
        "gap_analysis": gap_text,
        "deep_dive_queries": deep_dive_queries,
        "status": "gaps_analyzed",
    }


async def generate_report(state: dict) -> dict:
    """Node 5: Build the Markdown report (source of truth for all export formats)."""
    session_id = state.get("session_id", "default")
    set_progress(session_id, "complete", "Formatting final Markdown report...")

    from agent.report import build_markdown_report

    original = state.get("original_queries") or state["queries"]
    expanded = state["queries"]
    markdown = build_markdown_report(
        queries=original,
        summaries=state["summaries"],
        gap_analysis=state["gap_analysis"],
        deep_dive_queries=state.get("deep_dive_queries", []),
        expanded_queries=expanded if expanded != original else None,
    )
    return {"markdown_report": markdown, "status": "complete"}
