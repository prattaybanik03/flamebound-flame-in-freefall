#!/usr/bin/env python3
# SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
"""Fetch NASA PSI combustion investigations and their experimental tables.

Data source: NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov
Licence of the data: CC0-1.0 (per each investigation record). Cite each
investigation by its DOI.

Usage:
    python scripts/fetch_psi.py            # fetch everything into data/
    python scripts/fetch_psi.py --ids PSI-98 PSI-25

Outputs:
    data/raw/<ID>.json                     full investigation record from the API
    data/raw/tables/<ID>/<file>.csv        experimental tables (test conditions)
    data/investigations.json               cleaned records, one per investigation
    data/tests.csv                         every experimental-table row, long form,
                                           tagged with investigation ID, acronym, DOI
    data/tests_normalized.csv              one row per test, with oxygen / pressure /
                                           flow / material-or-fuel / burn-time pulled
                                           out (raw values + source column kept)
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
from pathlib import Path

import requests

API = "https://psi.nasa.gov/geode-py/ws"
PORTAL = "https://psi.nasa.gov/physci/repo/data/investigations"

# Combustion investigations listed by the PSI search "combustion" (Nov 2026).
# Flight (ISS / Cygnus) and ground/analysis investigations are both included;
# `project_type` in the output tells them apart.
#   Excluded: PSI-108 (STDCE-1, surface tension) and PSI-181 (solders) are not
#   combustion even though the keyword search returns them.
DEFAULT_IDS = [
    "PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-25", "PSI-26",
    "PSI-39", "PSI-60", "PSI-62", "PSI-68", "PSI-69", "PSI-98", "PSI-99",
    "PSI-100", "PSI-101", "PSI-102", "PSI-106", "PSI-107",
    "PSI-115", "PSI-117", "PSI-142", "PSI-159",
]

# Column-name patterns for the conditions most fire-safety questions turn on.
# Tables use different headers (e.g. "Percent O2", "XO2 (init)", "Oxygen"), so we
# match loosely and keep the original column name and raw value for traceability.
KEY_FIELDS = {
    "oxygen": re.compile(r"(^|\W)(x\s*o2|percent\s*o2|o2\s*\(|oxygen|%\s*o2)|\bo2\b", re.I),
    "pressure": re.compile(r"press|(^|\W)p\s*\(|pmean|pinit|psi[a]?\b|\batm\b", re.I),
    "flow": re.compile(r"flow|velocity|cm/s", re.I),
    "material_or_fuel": re.compile(r"material|fuel|sample\s*(type|material)", re.I),
    "burn_time": re.compile(r"burn\s*time|duration", re.I),
}

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"

session = requests.Session()
session.headers["User-Agent"] = "flame-in-freefall/0.1 (NASA Space Apps 2026)"


def clean(text: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


def get_json(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            r = session.get(url, timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"  retry {attempt + 1} for {url}: {exc}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def download_file(inv_id: str, file_name: str, version: int) -> str:
    """Download a PSI file. redirect=true makes the API 302 to a signed S3 URL."""
    params = {"file": file_name, "version": str(version), "redirect": "true"}
    r = session.get(f"{API}/studies/{inv_id}/download", params=params, timeout=120)
    r.raise_for_status()
    # PSI CSVs are sometimes Windows-1252 rather than UTF-8.
    try:
        return r.content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return r.content.decode("cp1252", errors="replace")


def summarise(rec: dict) -> dict:
    pubs = []
    for p in rec.get("publications") or []:
        if isinstance(p, dict):
            pubs.append({
                "title": clean(p.get("title")),
                "authors": clean(p.get("authors")),
                "doi": clean(p.get("doi")),
                "year": clean(str(p.get("year") or p.get("publicationYear") or "")),
            })
        else:
            pubs.append({"title": clean(str(p))})
    inv_id = rec.get("accession")
    return {
        "id": inv_id,
        "acronym": clean(rec.get("investigationAcronym")),
        "title": clean(rec.get("title")),
        "doi": clean(rec.get("doi")),
        "doi_url": f"https://doi.org/{clean(rec.get('doi'))}" if rec.get("doi") else "",
        "portal_url": f"{PORTAL}/{inv_id}",
        "research_area": clean(rec.get("researchArea")),
        "sub_research_area": clean(rec.get("subResearchArea")),
        "project_type": clean(rec.get("projectType")),
        "flight_platform": clean(rec.get("flightProgram")),
        "hardware": clean(rec.get("experimentHardware")),
        "start_date": clean(rec.get("investigationStartDate")),
        "end_date": clean(rec.get("investigationEndDate")),
        "nasa_center": clean(rec.get("managingNasaCenter")),
        "license": clean(rec.get("licenseIdentifier")),
        "objective": clean(rec.get("objective")),
        "hypothesis": clean(rec.get("hypothesis")),
        "approach": clean(rec.get("approach")),
        "research_impacts": clean(rec.get("researchImpacts")),
        "related": clean(rec.get("related_glds")),
        "publications": pubs,
        "experimental_tables": [f.get("file_name") for f in rec.get("experimentalTable") or []],
        "total_file_size_bytes": rec.get("totalFileSize"),
        "version": rec.get("version"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", nargs="*", default=DEFAULT_IDS)
    args = ap.parse_args()

    (RAW / "tables").mkdir(parents=True, exist_ok=True)
    investigations, test_rows = [], []

    for inv_id in args.ids:
        print(f"{inv_id}: fetching record")
        rec = get_json(f"{API}/repo/investigations/{inv_id}")
        (RAW / f"{inv_id}.json").write_text(json.dumps(rec, indent=2), encoding="utf-8")
        summary = summarise(rec)
        investigations.append(summary)

        for file_name in summary["experimental_tables"]:
            print(f"  table: {file_name}")
            try:
                text = download_file(inv_id, file_name, rec.get("version", 1))
            except Exception as exc:  # noqa: BLE001
                print(f"  ! failed: {exc}", file=sys.stderr)
                continue
            out = RAW / "tables" / inv_id / file_name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text, encoding="utf-8")
            reader = csv.DictReader(io.StringIO(text))
            for i, row in enumerate(reader):
                for col, val in row.items():
                    if col is None or val is None or not str(val).strip():
                        continue
                    test_rows.append({
                        "investigation_id": inv_id,
                        "acronym": summary["acronym"],
                        "doi": summary["doi"],
                        "table": file_name,
                        "row": i,
                        "column": col.strip(),
                        "value": str(val).strip(),
                    })
        time.sleep(0.3)  # be polite to the PSI API

    (DATA / "investigations.json").write_text(
        json.dumps(investigations, indent=2, ensure_ascii=False), encoding="utf-8")
    with (DATA / "tests.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["investigation_id", "acronym", "doi", "table",
                                           "row", "column", "value"])
        w.writeheader()
        w.writerows(test_rows)

    # Wide, normalised view: one row per test row, key conditions pulled out.
    by_row: dict[tuple, dict] = {}
    for t in test_rows:
        key = (t["investigation_id"], t["table"], t["row"])
        rec = by_row.setdefault(key, {
            "investigation_id": t["investigation_id"], "acronym": t["acronym"],
            "doi": t["doi"], "table": t["table"], "row": t["row"],
            **{f: "" for f in KEY_FIELDS}, **{f"{f}_column": "" for f in KEY_FIELDS},
        })
        for field, pat in KEY_FIELDS.items():
            if not rec[field] and pat.search(t["column"]):
                rec[field] = t["value"]
                rec[f"{field}_column"] = t["column"]
    if by_row:
        with (DATA / "tests_normalized.csv").open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(next(iter(by_row.values())).keys()))
            w.writeheader()
            w.writerows(by_row.values())

    n_tables = sum(len(i["experimental_tables"]) for i in investigations)
    print(f"\nDone: {len(investigations)} investigations, {n_tables} tables, "
          f"{len(test_rows)} table cells -> {DATA}")


if __name__ == "__main__":
    main()
