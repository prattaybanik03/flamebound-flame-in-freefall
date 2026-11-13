#!/usr/bin/env python3
# SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
"""Build web/src/data/pyrovector.json, the data bundle the PyroVector app ranks over.

Inputs (all produced by the repo's own scripts, all traceable to NASA PSI):
    data/investigations.json              investigation text, DOI, portal URL
    data/conditions.csv                   canonical conditions per record (+ status)
    data/raw/tables/<ID>/<file>.csv       raw tables, read only for outcome columns

Every record keeps: investigation ID, table file, row index, test reference, and
for each condition the canonical interval, discrete levels, status, raw cell and
source column. Nothing here invents a value; derived fields say what they derive
from.

Usage:  python scripts/build_app_data.py
"""
from __future__ import annotations

import csv
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw" / "tables"
OUT = ROOT / "web" / "src" / "data" / "pyrovector.json"

# Pillar / scale / phase per investigation. PROVISIONAL mapping, see agents/DECISIONS.md.
META = {
    "PSI-98": ("flammability", "full", "solid"),      # SAFFIRE-I (Cygnus, full scale)
    "PSI-99": ("flammability", "full", "solid"),      # SAFFIRE-II
    "PSI-100": ("flammability", "full", "solid"),     # SAFFIRE-III
    "PSI-25": ("flammability", "chamber", "solid"),   # BASS-II
    "PSI-26": ("flammability", "chamber", "solid"),   # BASS
    "PSI-20": ("flammability", "chamber", "surrogate"),  # ACME BRE: gas burner emulating condensed fuel
    "PSI-69": ("suppression", "chamber", "liquid"),   # FLEX
    "PSI-68": ("suppression", "chamber", "liquid"),   # FLEX-2
    "PSI-39": ("suppression", "chamber", "liquid"),   # CFI
    "PSI-159": ("suppression", "chamber", "gas"),     # ACME CFI-G
    "PSI-101": ("detection", "chamber", "solid"),     # SAME-R
    "PSI-102": ("detection", "chamber", "solid"),     # SAME
}
DEFAULT_META = ("fundamentals", "chamber", "gas")

# Rows where NASA's table counts records rather than single tests.
RECORD_NOT_TEST = {"PSI-20", "PSI-68"}
# Rows that are NASA's PLANNED condition envelopes, not executed tests. Locked Sat 11:20:
# shown as context only, never ranked.
PLANNED_ENVELOPES = {"PSI-68"}

# Material keys: canonical token -> regex over the material cell / table name.
MATERIALS = [
    ("sibal", r"sibal|cotton"),
    ("pmma", r"pmma|acrylic"),
    ("nomex", r"nomex"),
    ("silicone", r"silicone"),
    ("kapton", r"kapton"),
    ("teflon", r"teflon|ptfe"),
    ("pyrell", r"pyrell"),
    ("lampwick", r"lampwick"),
    ("heptane", r"heptane"),
    ("methanol", r"methanol"),
    ("ethanol", r"\bethanol"),
    ("decane", r"\bdecane"),
    ("octane", r"octane"),
    ("dodecane", r"c12h26|dodecane"),
    ("ethylene", r"c2h4|ethylene"),
    ("methane", r"\bch4\b|methane"),
    ("ethane", r"\bc2h6\b|\bethane"),
    ("propane", r"c3h8|propane"),
    ("propylene", r"propylene|c3h6"),
    ("butane", r"butane"),
    ("hydrogen", r"\bh2\b|hydrogen"),
    ("wax", r"wax|candle|paraffin"),
    ("ultem", r"ultem"),
]


def material_keys(text: str) -> list[str]:
    t = (text or "").lower()
    return [k for k, pat in MATERIALS if re.search(pat, t)]


def num_or_none(s: str):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def condition(r: dict, f: str) -> dict:
    levels = [float(x) for x in (r.get(f"{f}_levels") or "").split("|") if x.strip()]
    return {
        "min": num_or_none(r.get(f"{f}_min")),
        "max": num_or_none(r.get(f"{f}_max")),
        "levels": levels,
        "status": r.get(f"{f}_status") or "not_recorded",
        "raw": r.get(f"{f}_raw") or "",
        "col": r.get(f"{f}_col") or "",
    }


def load_raw_rows(inv_id: str, table: str) -> list[dict]:
    path = RAW / inv_id / table
    if not path.exists():
        return []
    with path.open(encoding="utf-8", errors="replace") as fh:
        return list(csv.DictReader(fh))


def outcome_for(inv_id: str, raw: dict) -> dict | None:
    """Outcome fields copied verbatim from the raw table. Category is a plain mapping."""
    if not raw:
        return None
    g = lambda *keys: next((raw[k].strip() for k in raw if k and any(k.strip().lower() == x.lower() for x in keys) and raw[k] and raw[k].strip()), "")
    if inv_id == "PSI-69":  # FLEX
        end = g("Test end")
        cat = {"extinction": "extinguished", "disruption": "disruption"}.get(end.lower(), "other") if end else None
        return {"category": cat, "fields": {
            "Test end": end, "Visible flame extinction diameter (mm)": g("Visible flame extinction diameter; mm"),
            "Burning rate (mm²/s)": g("Burning rate; mm"), "Burn time (s)": g("Burn time; s")}}
    if inv_id == "PSI-159":  # ACME CFI-G
        se = g("Self-ext or flow term", "Self -ext or flow term")
        cool = g("Cool flame?")
        cat = "cool_flame" if cool.lower().startswith("y") else (
            "self_extinguished" if se.upper().startswith("SE") else "flow_terminated" if se.upper().startswith("FT") else None)
        return {"category": cat, "fields": {
            "Self-extinguished (SE) or flow-terminated (FT)": se, "Cool flame?": cool,
            "Hot ignition": g("Hot ignition"), "Burn time (s)": g("burn time (sec)")}}
    if inv_id == "PSI-99":  # SAFFIRE-II: direct 1g vs microgravity comparison
        return {"category": None, "fields": {
            "Microgravity burn length": g("?-g Burn Length"), "Microgravity spread": g("?-g Spread Length"),
            "1-g burn length": g("1-g Burn Length"), "1-g spread rate": g("1-g Spread Rate"),
            "Burn time (s)": g("Burn Time (s)"), "Flow direction": g("Flow Direction")}}
    if inv_id in ("PSI-98",):
        return {"category": None, "fields": {"Burn time (s)": g("Burn Time (s)"), "Flow direction": g("Flow Direction")}}
    if inv_id == "PSI-100":
        return {"category": None, "fields": {"Flow direction": g("Direction")}}
    if inv_id == "PSI-20":
        return {"category": None, "fields": {"Flames ignited (that day)": g("Flames Ignited"),
                                             "Burner size (mm)": g("Burner Size (mm)")}}
    return None


def main() -> None:
    invs = json.loads((DATA / "investigations.json").read_text(encoding="utf-8"))
    with (DATA / "conditions.csv").open(encoding="utf-8") as fh:
        cond_rows = list(csv.DictReader(fh))

    raw_cache: dict[tuple, list[dict]] = {}
    records = []
    last_material: dict[tuple, str] = {}
    for r in cond_rows:
        inv_id, table, row = r["investigation_id"], r["table"], int(r["row"])
        key = (inv_id, table)
        if key not in raw_cache:
            raw_cache[key] = load_raw_rows(inv_id, table)
        raw = raw_cache[key][row] if row < len(raw_cache[key]) else {}

        material = r["material"] or ""
        material_note = ""
        # SAFFIRE-II leaves the material cell blank when it repeats the row above.
        if not material and inv_id == "PSI-99" and key in last_material:
            material = last_material[key]
            material_note = "Material cell blank in NASA table; same as previous sample"
        if inv_id == "PSI-10":  # ACME Flame Design: 'material' column is the flame type
            fuel = "C2H4" if "Inverse" in table or "C2H4" in (r["material"] or "") else r["material"]
            material = f"{fuel} ({'inverse' if 'Inverse' in table else 'normal'} flame)"
        if material:
            last_material[key] = material

        pillar, scale, phase = META.get(inv_id, DEFAULT_META)
        records.append({
            "id": f"{inv_id}:{table}:{row}",
            "inv": inv_id,
            "table": table,
            "row": row,
            "ref": r["test_ref"],
            "material": material,
            "materialNote": material_note,
            "materialKeys": material_keys(material),
            "orientation": r["orientation"],
            "gravity": r["gravity"],
            "burnTimeS": num_or_none(r["burn_time_s"]),
            "o2": condition(r, "oxygen"),
            "pressure": condition(r, "pressure"),
            "flow": condition(r, "flow"),
            "thickness": condition(r, "thickness"),
            "outcome": outcome_for(inv_id, raw),
        })

    investigations = []
    for inv in invs:
        pillar, scale, phase = META.get(inv["id"], DEFAULT_META)
        investigations.append({
            "id": inv["id"],
            "acronym": inv["acronym"] or inv["id"],
            "title": inv["title"],
            "doi": inv["doi"],
            "doiUrl": inv["doi_url"],
            "portalUrl": inv["portal_url"],
            "projectType": inv["project_type"],
            "platform": inv["flight_platform"],
            "hardware": inv["hardware"],
            "start": inv["start_date"],
            "end": inv["end_date"],
            "objective": inv["objective"],
            "approach": inv["approach"],
            "impacts": inv["research_impacts"],
            "pillar": pillar,
            "scale": scale,
            "phase": phase,
            "recordsNotTests": inv["id"] in RECORD_NOT_TEST,
            "plannedEnvelope": inv["id"] in PLANNED_ENVELOPES,
            "nRecords": sum(1 for x in records if x["inv"] == inv["id"]),
            "publications": [p.get("title", "") for p in inv.get("publications", [])][:12],
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "builtOn": date.today().isoformat(),
        "source": "NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov, CC0-1.0",
        "investigations": investigations,
        "records": records,
    }
    OUT.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    with_outcome = sum(1 for x in records if x["outcome"])
    print(f"{len(investigations)} investigations, {len(records)} records "
          f"({with_outcome} with outcome fields) -> {OUT} ({OUT.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    main()
