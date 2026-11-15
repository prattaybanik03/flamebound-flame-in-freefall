# SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
# Self-audit helper (ours, not independent). Run from the repository root after run_baseline.mts:
#   python docs/audit/check_sources.py
# Needs NASA's original tables in data/raw/tables (fetched by scripts/fetch_psi.py; not stored in git).
# For each acceptance scenario's top match it compares the record reference, material, oxygen and airflow
# cells FlameBound shows with the text in NASA's original table row, and lists any pressure columns.
import csv, io, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOP = json.loads((Path(__file__).parent / "scenario_top.json").read_text())
PRESSURE = re.compile(r"press|kpa|psi\b|atm", re.I)

def load(inv_id: str, table: str):
    raw = (ROOT / "data/raw/tables" / inv_id / table).read_text(encoding="utf-8-sig", errors="replace")
    return [r for r in csv.reader(io.StringIO(raw)) if any(c.strip() for c in r)]

out = [["scenario", "nasa_record", "table_file", "data_row", "app_material", "app_o2_cell", "app_airflow_cell",
        "nasa_row_has_ref", "nasa_row_has_material", "nasa_row_has_o2_cell", "nasa_row_has_airflow_cell", "nasa_pressure_columns"]]
for s in TOP:
    r = s["rec"]; rows = load(s["inv"], r["table"]); hdr = rows[0]; row = rows[r["row"] + 1]
    vals = [c.strip() for c in row]; low = [v.lower() for v in vals]
    ref_ok = r["ref"].strip() in vals or r["ref"].strip() == str(r["row"] + 1)
    mat_ok = r["material"].strip().lower() in low
    o2_ok = r["o2"]["raw"].strip() in vals
    fl_ok = r["flow"]["status"] == "not_recorded" or r["flow"]["raw"].strip() in vals
    pcols = [h.strip() for h in hdr if PRESSURE.search(h)]
    out.append([s["id"], f'{s["acr"]} {r["ref"]}', r["table"], r["row"] + 1, r["material"], r["o2"]["raw"], r["flow"]["raw"],
                ref_ok, mat_ok, o2_ok, fl_ok, "; ".join(pcols) or "none"])
(Path(__file__).parent / "source_audit_7.csv").write_text("\n".join(",".join('"%s"' % str(c).replace('"', '""') for c in r) for r in out) + "\n")
ok = sum(all(r[7:11]) for r in out[1:])
print(f"{ok} of {len(out) - 1} scenario top matches have ref, material, O2 and airflow cells identical to NASA's row")

# Oxygen range of BASS-II (the table that sets the solid-material range) from the original file
rows = load("PSI-25", "PSI-25_Experimental table_BASS-II.csv"); col = [i for i, h in enumerate(rows[0]) if "initial O2" in h][0]
v = [float(r[col]) for r in rows[1:] if col < len(r) and re.fullmatch(r"\d+(\.\d+)?", r[col].strip())]
print(f"BASS-II initial O2: {len(v)} values, {min(v)} to {max(v)} % by volume")
