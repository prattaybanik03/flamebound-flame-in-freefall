# Data pipeline

All data comes from NASA's [Physical Sciences Informatics (PSI)](https://psi.nasa.gov/physci/repo/search?q=combustion) repository. Records are licensed CC0-1.0. Cite each investigation by its DOI, as PSI requests.

```bash
pip install -r requirements.txt
python scripts/fetch_psi.py
```

This fetches 23 combustion investigations through the public PSI API. They cover ACME (Flame Design, BRE, CLD, E-FIELD, s-Flame, CFI-G), BASS, BASS-II, CFI, FLEX, FLEX-2, Saffire I-III, SAME, SAME-R, SLICE, SPICE and several analysis studies. Each experimental table comes with it.

| Output | What it is |
| --- | --- |
| `data/investigations.json` | One cleaned record per investigation: objective, hypothesis, approach, research impacts, hardware, dates, DOI, publications |
| `data/tests.csv` | Every experimental-table cell in long form, tagged with investigation ID and DOI |
| `data/tests_normalized.csv` | One row per test, with oxygen, pressure, flow, material or fuel, and burn time extracted. Each value keeps its original column name. |
| `data/conditions.csv` | **Canonical conditions layer** (`python scripts/build_conditions.py`). One row per table record with oxygen (% vol), pressure (kPa), airflow (cm/s), thickness (cm) as min/max/levels, plus a status, the raw cell and source column per value |
| `data/raw/` | Untouched API responses and CSVs, for traceability |

`tests_normalized.csv` is the first-pass regex extraction and keeps raw strings; it misses oxygen in 9 investigations and pressure in 14, so use `conditions.csv` for filtering and ranking.

## `conditions.csv` rules

- Every mapping from a table column to a canonical unit is explicit in `scripts/build_conditions.py`, so a reviewer can audit it.
- Status per value: `recorded`, `approx` (`~21.5`), `range` (`21.5 - 21.7`), `levels` (discrete list such as `21; 26.5; 40`; match against the listed levels, never the span between them), `footnote` (from a note printed with the table), `not_recorded`, `unparsed`, `suspect`.
- `not_recorded` means the PSI table has no such column. It is never guessed. Several tables (BASS, BASS-II, SAFFIRE, SAME) omit pressure.
- `suspect` means the value is physically implausible or ambiguous and is withheld, with the raw text kept. Known source typos: ACME BRE oxygen "3400%" / "2100%", SAFFIRE-II thickness "037 mm".
- A row is not always one test: ACME BRE rows are test days with several flames, and FLEX-2 rows are planned condition envelopes. Count them as records, not tests.
- PSI-142 (literature figure index) and the ground-only analysis investigations (PSI-60, 62, 115, 117) have no test conditions.

## App data bundle

`python scripts/build_app_data.py` writes `web/public/data/flamebound.json`: 23 investigations and 1,980 records. Each record keeps its investigation ID, table file, row, test reference, material and, for every condition, the canonical interval, discrete levels, status, raw cell and source column. Outcome columns (FLEX test end, CFI-G self-extinction, SAFFIRE-II 1 g vs microgravity burn results) are copied verbatim. FLEX-2 is flagged as a planned condition envelope (context only, never ranked).
