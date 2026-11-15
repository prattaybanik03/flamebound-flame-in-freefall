# Self-audit and baseline check

Run by the FlameBound team. It is **ours, not an independent review**, and it is published so anyone can inspect and rerun it.

| File | What it is |
|---|---|
| `source_audit_7.csv` | The top match of each of the 7 acceptance scenarios, compared cell by cell with NASA's original table row (record reference, material, oxygen, airflow). Result: 7 of 7 identical. NASA's tables list no pressure column for these records. |
| `baseline_atlas_64.csv` | All 64 Atlas cells (4 atmospheres x 8 materials x 2 airflows) labelled "covered" or "gap" by FlameBound and by a simple baseline. |
| `scenario_top.json` | Intermediate output used by `check_sources.py`. |
| `run_baseline.mts` | Produces `scenario_top.json` and `baseline_atlas_64.csv`. |
| `check_sources.py` | Produces `source_audit_7.csv`; also prints the oxygen range of the BASS-II table. |

## Baseline

Keep flammability records that have a usable oxygen value. If any record tests the exact material, pick the one with the smallest oxygen gap (ties: nearest airflow); otherwise take the nearest-oxygen solid record. The baseline calls a cell "covered" only when an exact-material record lies within 2 percentage points of oxygen.

Result: the two methods give the same label in 56 of 64 cells. The 8 differences are all ISS-cabin cells where FlameBound counts a related material (SIBAL) as covering the target material and the baseline, which needs the exact material, does not. Whether that substitution is acceptable is a judgement call, which is why the matching record is always shown.

## Rerun

From the repository root, after `python scripts/fetch_psi.py` has downloaded NASA's tables to `data/raw/` (not stored in git):

```
node --experimental-strip-types docs/audit/run_baseline.mts
python docs/audit/check_sources.py
```

Needs Node 22+ and Python 3.
