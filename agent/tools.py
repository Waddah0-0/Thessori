import httpx
from typing import Any

ARXIV_URL = "https://export.arxiv.org/api/query"
S2_URL = "https://api.semanticscholar.org/graph/v1/paper/search"


async def fetch_arxiv(query: str, max_results: int) -> list[dict[str, Any]]:
    """Fetch papers from arXiv. Returns a list of paper dicts."""
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "relevance",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(ARXIV_URL, params=params)
        response.raise_for_status()

    # arXiv returns Atom XML — parse it minimally.
    import xml.etree.ElementTree as ET

    ns = {"atom": "http://www.w3.org/2005/Atom"}
    root = ET.fromstring(response.text)
    papers: list[dict[str, Any]] = []
    for entry in root.findall("atom:entry", ns):
        papers.append(
            {
                "source": "arxiv",
                "title": entry.findtext("atom:title", default="", namespaces=ns).strip(),
                "abstract": entry.findtext("atom:summary", default="", namespaces=ns).strip(),
                "url": entry.findtext("atom:id", default="", namespaces=ns).strip(),
                "authors": [
                    a.findtext("atom:name", default="", namespaces=ns)
                    for a in entry.findall("atom:author", ns)
                ],
                "year": entry.findtext("atom:published", default="", namespaces=ns)[:4],
            }
        )
    return papers


async def fetch_semantic_scholar(
    query: str, max_results: int, api_key: str = ""
) -> list[dict[str, Any]]:
    """Fetch papers from Semantic Scholar. Returns a list of paper dicts."""
    params = {
        "query": query,
        "limit": max_results,
        "fields": "title,abstract,authors,year,url,externalIds",
    }
    headers = {"x-api-key": api_key} if api_key else {}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(S2_URL, params=params, headers=headers)
        response.raise_for_status()

    data = response.json()
    papers: list[dict[str, Any]] = []
    for item in data.get("data", []):
        papers.append(
            {
                "source": "semantic_scholar",
                "title": item.get("title") or "",
                "abstract": item.get("abstract") or "",
                "url": item.get("url") or "",
                "authors": [a.get("name", "") for a in (item.get("authors") or [])],
                "year": str(item.get("year") or ""),
            }
        )
    return papers
