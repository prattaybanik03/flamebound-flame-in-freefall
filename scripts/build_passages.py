# SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
"""Build web/public/data/passages.json: the text corpus for "Ask NASA's records".

Each of the 23 PSI investigation records is split into short passages (objective, hypothesis,
approach, research impacts, and publication titles). Text is copied verbatim from
data/investigations.json; only whitespace is normalised. Every passage keeps its investigation,
field and DOI so an answer can cite it.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "investigations.json"
BUNDLE = ROOT / "web" / "public" / "data" / "flamebound.json"
OUT = ROOT / "web" / "public" / "data" / "passages.json"
FIELDS = [("objective", "objective"), ("hypothesis", "hypothesis"), ("approach", "approach"), ("research_impacts", "research impacts")]
MAX_CHARS = 650

# Split after . ! ? followed by space + capital letter or digit (keeps decimals and "e.g." intact).
SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"(])")


def chunks(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not text:
        return []
    out, cur = [], ""
    for s in SENT.split(text):
        if cur and len(cur) + 1 + len(s) > MAX_CHARS:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


def main() -> None:
    invs = json.loads(SRC.read_text(encoding="utf-8"))
    names = {i["id"]: i["acronym"] for i in json.loads(BUNDLE.read_text(encoding="utf-8"))["investigations"]}
    passages = []
    for inv in invs:
        acronym = inv.get("acronym") or names.get(inv["id"]) or inv["id"]
        base = {"psi": inv["id"], "acronym": acronym, "title": inv["title"], "doi": inv["doi"]}
        for field, label in FIELDS:
            for text in chunks(inv.get(field, "")):
                passages.append({**base, "field": label, "text": text})
        titles = [p["title"].strip() for p in (inv.get("publications") or []) if p.get("title")]
        if titles:
            text = "Publications: " + "; ".join(titles[:15]) + "."
            passages.append({**base, "field": "publication titles", "text": text[:1500]})
    for n, p in enumerate(passages, 1):
        p["id"] = f"P{n}"
    OUT.write_text(json.dumps(passages, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(invs)} investigations -> {len(passages)} passages -> {OUT} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
