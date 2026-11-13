#!/usr/bin/env python3
# SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
"""Build data/conditions.csv: one row per test record, conditions in canonical units.

Why this exists: the PSI experimental tables are heterogeneous test logs. Oxygen is a
mole fraction in some tables and a percent in others, pressure is atm / bar / mmHg,
and many cells hold ranges ("21.5 - 21.7"), approximations ("~ 21.5") or discrete
level lists ("21; 26.5; 40"). Every mapping below is explicit and auditable.

Canonical units: oxygen = percent by volume (mole fraction x 100), pressure = kPa,
airflow = cm/s, thickness = cm, time = s.

Every condition carries:
    <f>_min, <f>_max   canonical interval (equal for a single value)
    <f>_levels         pipe-separated discrete values when the table lists levels
                       (do NOT treat these as a continuous range when matching)
    <f>_status         recorded | approx | range | levels | footnote |
                       not_recorded | unparsed | suspect
    <f>_raw, <f>_col   the original cell text and column name, for traceability

`suspect` = parsed but physically implausible or ambiguous (source typo); value
withheld, raw text kept.
Nothing is inferred silently: a condition the table does not record is
`not_recorded`, never guessed. `footnote` means the value comes from a note printed
with the table itself.

Usage:  python scripts/build_conditions.py
"""
from __future__ import annotations

import csv
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw" / "tables"

ATM_KPA, MMHG_KPA, BAR_KPA = 101.325, 0.133322, 100.0
FIELDS = ["oxygen", "pressure", "flow", "thickness"]

# unit tag -> multiplier into the canonical unit of that field
O2_UNITS = {"frac": 100.0, "pct": 1.0}
P_UNITS = {"atm": ATM_KPA, "mmHg": MMHG_KPA, "bar": BAR_KPA}
FLOW_UNITS = {"cm/s": 1.0, "mm/s": 0.1}
THICK_UNITS = {"cm": 1.0, "mm": 0.1, "um": 1e-4}

NUM = r"\d*\.?\d+"


def parse_value(raw: str, scale: float | None, unit_scale: dict | None = None):
    """Parse one cell. Returns (min, max, levels, status).

    `scale` is the column's unit multiplier. If the cell itself carries a unit
    (e.g. "20 cm/s", "0.37 mm") and `unit_scale` is given, the cell's unit wins.
    """
    s = raw.strip()
    if not s:
        return None, None, None, "not_recorded"
    approx = s.startswith("~") or s.lower().startswith("approx")
    s2 = s.lstrip("~ ").strip()
    mult = scale
    if unit_scale:
        m = re.search(r"(" + "|".join(re.escape(u) for u in unit_scale) + r")\s*$", s2)
        if m:
            mult = unit_scale[m.group(1)]
            s2 = s2[: m.start()].strip()
    if mult is None:
        return None, None, None, "unparsed"
    s2 = re.sub(r"(percent|%|atm|bar|mmHg)\s*$", "", s2, flags=re.I).strip()
    # discrete level list: "21; 26.5; 40" or "0.5; 1.0; ... or 3.0"
    if ";" in s2:
        parts = [p for p in re.split(r";|\bor\b", s2) if p.strip()]
        try:
            vals = [float(re.sub(r"[^\d.]", "", p)) * mult for p in parts]
        except ValueError:
            return None, None, None, "unparsed"
        return min(vals), max(vals), "|".join(f"{v:g}" for v in vals), "levels"
    # continuous interval: "21.5 - 21.7", "0.1 - 5"
    m = re.fullmatch(rf"({NUM})\s*(?:-|–|to)\s*({NUM})", s2)
    if m:
        lo, hi = float(m.group(1)) * mult, float(m.group(2)) * mult
        return lo, hi, None, "range"
    m = re.fullmatch(NUM, s2)
    if m:
        v = float(s2) * mult
        return v, v, None, "approx" if approx else "recorded"
    return None, None, None, "unparsed"


# --------------------------------------------------------------------------
# Per-table specification. cond: field -> (column, unit_tag). A column that is
# absent from the table is simply not listed and becomes `not_recorded`.
# `material`: column holding the fuel / sample material. `ref`: row label column.
# `footnote`: field -> (value in canonical unit, footnote text) for values the
# table prints only in its own notes.
# --------------------------------------------------------------------------
SPECS = {
    "PSI-10_Experimental table_Flame Design_Normal Flame.csv": dict(
        ref="Test", material="Fuel", cond={"oxygen": ("XO2 (init)", "frac"), "pressure": ("pinit (atm)", "atm")}),
    "PSI-10_Experimental table_Flame Design_Inverse Flame.csv": dict(
        ref="Test", material="Flame Type", cond={"oxygen": ("XO2", "frac"), "pressure": ("pinit (atm)", "atm")}),
    "PSI-20_Experimental table_ACME BRE.csv": dict(
        ref="Date", material="Fuel Bottle", cond={"oxygen": ("Oxygen Conc (percent)", "pct")}),
    "PSI-21_Experimental table_CLD Flame.csv": dict(ref="Test Day", material="Fuel Bottle", cond={}),
    "PSI-22_Experimental table_ACME E-FIELD Flames.csv": dict(ref="Test Day", material="Fuel Bottle", cond={}),
    "PSI-23_Experimental table_ACME s-Flame.csv": dict(
        ref="Test Day*", material="Fuel Bottle", cond={},
        oxygen_regex=("Atmosphere*", r"~?\s*(\d+(?:\.\d+)?)\s*%\s*O2"),
        footnote={"pressure": (ATM_KPA, "table note: 'Atmosphere is ~1 atm but pressure increases and O2% drops with vitiation'")}),
    "PSI-25_Experimental table_BASS-II.csv": dict(
        ref="Test #", material="Fuel Sample Material", cond={"oxygen": ("Calibrated  initial O2 % by vol", "pct")}),
    "PSI-26_Experimental table_BASS.csv": dict(ref="Test #", material="Fuel Sample Material", cond={}),
    "PSI-39_Experimental table_CFI.csv": dict(
        ref="Flex Number", material="Fuel", cond={"oxygen": ("Oxygen", "frac"), "pressure": ("Pressure", "atm")}),
    "PSI-68_Experimental table_Flex2.csv": dict(
        ref="Sample (Fuel Type)", material="Sample (Fuel Type)",
        cond={"oxygen": ("Oxygen Mole Fraction", "frac"), "pressure": ("Ambient Pressure (atm)", "atm"),
              "flow": ("Flow Velocity (cm/s)", "cm/s")}),
    "PSI-69_Experimental table_FLEX.csv": dict(
        ref="FLEX Test #", material="Fuel",
        cond={"oxygen": ("O initial ambient composition; mole fraction", "frac"),
              "pressure": ("Ambient pressure; mmHg", "mmHg")}),
    "PSI-98_Experimental table_SAFFIRE-1.csv": dict(
        ref="Sample Number", material="Material", orientation="Flow Direction",
        cond={"oxygen": ("Percent O2", "pct"), "flow": ("Air Flow (cm/s)", "cm/s"), "thickness": ("Sample Thickness (cm)", "cm")},
        burn_time="Burn Time (s)"),
    "PSI-99_Experimental table_SAFFIRE-2.csv": dict(
        ref="Sample Number", material="Material", orientation="Flow Direction",
        cond={"oxygen": ("Percent O2 (Note 1)", "pct"), "flow": ("Air Flow (cm/s)", "cm/s"), "thickness": ("Samle Thickness", "mm")},
        burn_time="Burn Time (s)"),
    "PSI-100_Experimental table_SAFFIRE-3.csv": dict(
        ref="Sample Number", material="Material", orientation="Direction",
        cond={"flow": ("Air Flow", "cm/s"), "thickness": ("Sample Thickness", "cm")}),
    "PSI-101_Experimental table_SAME-R.csv": dict(
        ref="SAME Test #", material="Sample Type", cond={"flow": ("Inlet velocity (cm/s)", "cm/s")}),
    "PSI-102_Experimental table_SAME.csv": dict(
        ref="Sample #", material="Sample Material", cond={"flow": ("Air Flow (cm/s)", "cm/s")}),
    "PSI-106_Experimental table_Slice.csv": dict(ref="Test Date", material="Fuel Type", cond={}),
    "PSI-107_Experimental table_Spice.csv": dict(
        ref="GMT ignition", material="Fuel", cond={"flow": ("Air Rate (cm/s)", "cm/s")}),
    "PSI-159_Experimental table_CFI-G_Normal Flames.csv": dict(
        ref="Test", material="Fuel", cond={"oxygen": ("XO2 before test", "frac"), "pressure": ("approx p (bar)", "bar")},
        burn_time="burn time (sec)"),
    "PSI-159_Experimental table_CFI-G_Inverse Flames.csv": dict(
        ref="Test", material="Fuel", cond={"oxygen": ("XO2", "frac"), "pressure": ("approx p (bar)", "bar")},
        burn_time="burn time (sec)"),
}
# PSI-142 is a data-summary list of literature figures, not test conditions: skipped.

SCALES = {"oxygen": (O2_UNITS, None), "pressure": (P_UNITS, None),
          "flow": (FLOW_UNITS, FLOW_UNITS), "thickness": (THICK_UNITS, THICK_UNITS)}
# Plausibility bounds in canonical units. A parsed value outside them is a source typo
# (e.g. BRE "3400%" for 34%), so it is quarantined as `suspect` rather than trusted.
BOUNDS = {"oxygen": (0, 100), "pressure": (1, 2000), "flow": (0, 200), "thickness": (0.001, 2)}
LEADING_ZERO = re.compile(r"^~?\s*0\d+(\s|$)")  # "037 mm": ambiguous, likely 0.37
SKIP_MATERIAL = re.compile(r"pre-test|flow visuali", re.I)


def read_table(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    rows = list(csv.DictReader(io.StringIO(text)))
    # Normalise headers: strip whitespace and collapse inner double spaces.
    return [{re.sub(r"\s+", " ", (k or "").strip()): (v or "").strip() for k, v in r.items()} for r in rows]


def norm(col: str) -> str:
    return re.sub(r"\s+", " ", col.strip())


def main() -> None:
    invs = {i["id"]: i for i in json.loads((DATA / "investigations.json").read_text(encoding="utf-8"))}
    out_rows = []
    cols_out = ["investigation_id", "acronym", "doi", "portal_url", "table", "row", "test_ref",
                "material", "orientation", "burn_time_s", "gravity"]
    for f in FIELDS:
        cols_out += [f"{f}_min", f"{f}_max", f"{f}_levels", f"{f}_status", f"{f}_raw", f"{f}_col"]

    for path in sorted(RAW.glob("PSI-*/*.csv")):
        spec = SPECS.get(path.name)
        if spec is None:
            print(f"skip (no spec): {path.name}")
            continue
        inv_id = path.parent.name
        inv = invs[inv_id]
        for i, r in enumerate(read_table(path)):
            material = r.get(norm(spec["material"]), "")
            if SKIP_MATERIAL.search(material):
                continue
            rec = {"investigation_id": inv_id, "acronym": inv["acronym"], "doi": inv["doi"],
                   "portal_url": inv["portal_url"], "table": path.name, "row": i,
                   "test_ref": r.get(norm(spec["ref"]), ""), "material": material,
                   "orientation": r.get(norm(spec.get("orientation", "")), ""),
                   "burn_time_s": r.get(norm(spec.get("burn_time", "")), ""),
                   "gravity": "microgravity" if "Microgravity" in inv["project_type"] else "unknown"}
            for f in FIELDS:
                rec.update({f"{f}_min": "", f"{f}_max": "", f"{f}_levels": "", f"{f}_status": "not_recorded",
                            f"{f}_raw": "", f"{f}_col": ""})
                if f in spec["cond"]:
                    col, unit = spec["cond"][f]
                    raw = r.get(norm(col), "")
                    units, cell_units = SCALES[f]
                    lo, hi, levels, status = parse_value(raw, units[unit], cell_units)
                    # a pressure of 0 is a missing value, not a vacuum test
                    if f == "pressure" and lo == 0:
                        lo = hi = None; status = "unparsed"
                    b = BOUNDS[f]
                    if lo is not None and (not (b[0] <= lo and hi <= b[1]) or LEADING_ZERO.match(raw)):
                        lo = hi = None; levels = None; status = "suspect"
                    rec.update({f"{f}_min": "" if lo is None else round(lo, 4),
                                f"{f}_max": "" if hi is None else round(hi, 4),
                                f"{f}_levels": levels or "", f"{f}_status": status,
                                f"{f}_raw": raw, f"{f}_col": col})
            if "oxygen_regex" in spec:
                col, pat = spec["oxygen_regex"]
                raw = r.get(norm(col), "")
                m = re.search(pat, raw)
                rec.update({"oxygen_raw": raw, "oxygen_col": col})
                if m:
                    v = float(m.group(1))
                    rec.update({"oxygen_min": v, "oxygen_max": v, "oxygen_status": "approx"})
                else:
                    rec["oxygen_status"] = "unparsed" if raw else "not_recorded"
            for f, (val, note) in spec.get("footnote", {}).items():
                rec.update({f"{f}_min": round(val, 4), f"{f}_max": round(val, 4),
                            f"{f}_status": "footnote", f"{f}_raw": note, f"{f}_col": "table note"})
            # Drop rows that carry neither a material nor any condition (blank/note rows).
            if not material and not any(rec[f"{f}_status"] not in ("not_recorded",) for f in FIELDS):
                continue
            out_rows.append(rec)

    with (DATA / "conditions.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols_out)
        w.writeheader()
        w.writerows(out_rows)

    # Coverage report: the honest picture of what each investigation records.
    print(f"\n{len(out_rows)} test records -> data/conditions.csv\n")
    print(f"{'ID':8}{'acronym':20}{'rows':>6}" + "".join(f"{f[:6]:>9}" for f in FIELDS))
    by: dict[str, list] = {}
    for r in out_rows:
        by.setdefault(r["investigation_id"], []).append(r)
    for inv_id in invs:
        rs = by.get(inv_id, [])
        cells = "".join(
            f"{sum(1 for r in rs if r[f'{f}_status'] not in ('not_recorded', 'unparsed')):>9}" for f in FIELDS)
        print(f"{inv_id:8}{invs[inv_id]['acronym'][:19]:20}{len(rs):>6}{cells}")
    bad = [(r["investigation_id"], f, r[f"{f}_status"], r[f"{f}_raw"]) for r in out_rows for f in FIELDS if r[f"{f}_status"] in ("unparsed", "suspect") and r[f"{f}_raw"]]
    print(f"\nunparsed non-empty cells: {len(bad)}")
    seen = set()
    for b in bad:
        if b not in seen:
            seen.add(b)
            if len(seen) <= 25:
                print("  ", b)


if __name__ == "__main__":
    main()
