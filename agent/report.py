def build_markdown_report(
    queries: list[str],
    summaries: list[dict],
    gap_analysis: str,
    deep_dive_queries: list[str] | None = None,
    expanded_queries: list[str] | None = None,
) -> str:
    """Build the literature review as Markdown (supports KaTeX math via $...$ syntax)."""
    deep_dive_queries = deep_dive_queries or []
    lines: list[str] = []

    lines.append("# Literature Review\n")
    lines.append("**Research queries:**\n")
    for q in queries:
        lines.append(f"- {q}")
    if expanded_queries:
        lines.append(
            "\n*AI-expanded search terms:* " + "; ".join(expanded_queries)
        )
    lines.append("\n---\n")
    lines.append("## Table of Contents\n")
    lines.append("1. [Paper Summaries](#paper-summaries)")
    lines.append("2. [Research Gaps & Future Directions](#research-gaps--future-directions)")
    if deep_dive_queries:
        lines.append("3. [Suggested Deep Dive Queries](#suggested-deep-dive-queries)")
    lines.append("\n---\n")
    lines.append("## Paper Summaries\n")

    for paper in summaries:
        authors = ", ".join(paper.get("authors", [])[:3])
        if len(paper.get("authors", [])) > 3:
            authors += " et al."
        lines.append(f"### {paper['title']}")
        lines.append(
            f"**Authors:** {authors} &nbsp;·&nbsp; "
            f"**Year:** {paper.get('year', 'N/A')} &nbsp;·&nbsp; "
            f"**Source:** [{paper.get('source', '')}]({paper.get('url', '')})\n"
        )
        lines.append(paper.get("summary", ""))
        lines.append("\n---\n")

    lines.append("## Research Gaps & Future Directions\n")
    lines.append(gap_analysis)

    if deep_dive_queries:
        lines.append("\n---\n")
        lines.append("## Suggested Deep Dive Queries\n")
        lines.append("Targeted follow-up searches to explore the gaps above:\n")
        for i, q in enumerate(deep_dive_queries, 1):
            lines.append(f"{i}. {q}")

    return "\n".join(lines)


def extract_deep_dive_queries(gap_analysis: str) -> list[str]:
    """Pull the suggested follow-up queries out of the gap-analysis text."""
    
    import re

    lines = gap_analysis.splitlines()
    queries: list[str] = []
    in_section = False
    for line in lines:
        stripped = line.strip()
        if re.match(r"^#+\s*Suggested Deep Dive Queries", stripped, re.IGNORECASE):
            in_section = True
            continue
        if not in_section:
            continue
        if stripped.startswith("#"):  # next heading ends the section
            break
        m = re.match(r"^[-*\d.]+\s*(.+)$", stripped)
        if m:
            # Strip stray Markdown emphasis and the example's [bracket] wrapper.
            q = m.group(1).strip().strip("*_`").strip()
            if q.startswith("[") and q.endswith("]"):
                q = q[1:-1].strip()
            if q:
                queries.append(q)
    return queries


def markdown_to_latex(markdown: str, queries: list[str]) -> str:
    """Convert the Markdown report to a full, compile-ready LaTeX document.

    Handles headings, bold, links, and inline math, and — crucially — escapes
    LaTeX special characters in body prose so summaries containing %, _, &, #,
    accented author names, etc. still compile in Overleaf / pdflatex.
    """
    import re

    specials = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\^{}",
    }
    special_re = re.compile("|".join(re.escape(k) for k in specials))

    def escape_tex(text: str) -> str:
        """Single pass: each special char is replaced exactly once and the
                replacement text is never re-scanned (avoids the double-escaping that
                    a naive sequence of str.replace() calls would cause)."""
        return special_re.sub(lambda m: specials[m.group()], text)

    # Inline tokenizer: $math$ (verbatim) | **bold** | [text](url) | · separator.
    inline_re = re.compile(
        r"(?P<math>\$[^$\n]+\$)"
        r"|\*\*(?P<bold>.+?)\*\*"
        r"|\[(?P<ltext>[^\]]+)\]\((?P<lurl>[^)]+)\)"
        r"|(?P<dot>·)"
    )

    def convert_inline(text: str) -> str:
        text = text.replace("&nbsp;", " ")  
        out: list[str] = []
        i = 0
        for m in inline_re.finditer(text):
            out.append(escape_tex(text[i : m.start()]))
            if m.group("math") is not None:
                out.append(m.group("math"))  
            elif m.group("bold") is not None:
                out.append(r"\textbf{" + escape_tex(m.group("bold")) + "}")
            elif m.group("ltext") is not None:
                out.append(
                    r"\href{" + m.group("lurl") + "}{" + escape_tex(m.group("ltext")) + "}"
                )
            elif m.group("dot") is not None:
                out.append(r"\textperiodcentered{}")
            i = m.end()
        out.append(escape_tex(text[i:]))
        return "".join(out)

    title = escape_tex("; ".join(queries))
    out = [
        r"\documentclass[12pt]{article}",
        r"\usepackage[utf8]{inputenc}",
        r"\usepackage[T1]{fontenc}",
        r"\usepackage{hyperref}",
        r"\usepackage{geometry}",
        r"\usepackage{parskip}",
        r"\usepackage{amsmath}",
        r"\geometry{margin=1in}",
        f"\\title{{Literature Review: {title}}}",
        r"\date{\today}",
        r"\begin{document}",
        r"\maketitle",
        r"\tableofcontents",
        r"\newpage",
    ]
    for line in markdown.split("\n"):
        if line.startswith("### "):
            out.append(r"\subsection{" + escape_tex(line[4:]) + "}")
        elif line.startswith("## "):
            out.append(r"\section{" + escape_tex(line[3:]) + "}")
        elif line.startswith("# "):
            continue  # document title is already set via \title
        elif line.strip() == "---":
            out.append(r"\medskip\hrule\medskip")
        else:
            out.append(convert_inline(line))
    out.append(r"\end{document}")
    return "\n".join(out)
