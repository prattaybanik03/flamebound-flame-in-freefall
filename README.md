# PyroVector

**Turning 23 NASA microgravity combustion investigations into boundary-matched, DOI-verified fire safety envelopes for spacecraft habitat engineers.**

NASA Space Apps Challenge 2026 · Melbourne Local Event · Challenge: [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/)

**Live app:** _URL added at deployment_

## What it does

An aerospace engineer is qualifying a cabin material for a crewed habitat. Typical cases are a lunar base or pressurised rover at about 30% O₂ and 10.2 psi, or an exploration atmosphere at 34% O₂ and 8.2 psi. The question is whether NASA's microgravity fire experiments actually cover that atmosphere, that airflow and that material.

PyroVector answers that from NASA's own data:

1. **Pick a mission atmosphere** (or set O₂, pressure and airflow), a material or fuel, and a safety pillar: Flammability or Suppression.
2. **Every NASA PSI record is scored** with a deterministic Boundary Condition Match Score (BCMS, 0–100). The score shows how closely that record's recorded conditions match the target. Each result card breaks the score into O₂, material, airflow, pressure and pillar/scale. It shows NASA's verbatim cell and column next to each converted value, and links the investigation's DOI.
3. **Gaps are shown, not hidden.** When NASA never recorded a condition, it contributes zero; nothing is guessed. When the best match in the chosen pillar is below 65%, or partial gravity is selected, an Extrapolation Hazard banner appears. It lists the nearest recorded NASA conditions, with exact differences, and notes that partial-gravity data is expected from NASA's LUCI and FM2 experiments.
4. **Cited 1 g vs microgravity evidence.** For materials NASA tested in both 1 g and microgravity (SAFFIRE-II), the app shows those records verbatim, with their differences from the target. When the hazard is active, it draws no conclusion about the engineer's cabin.
5. **Regime maps** plot every relevant NASA record against the target. Flammability shows O₂ vs airflow; Suppression shows O₂ vs pressure, coloured by NASA's recorded outcome.

**BCMS measures data coverage, not fire safety.** No warning does not mean safe.

## Method

```text
BCMS = 100 × Σ (weight × sub-score), over the dimensions NASA recorded
O₂ 30%:        exp(−|ΔO₂| / 15)    Δ in % points
Material 25%:  exact 1.0 · calibrated condensed-fuel surrogate 0.9 · same fuel phase 0.75 · other 0.4
Airflow 20%:   exp(−|ΔV| / 15)     Δ in cm/s
Pressure 15%:  exp(−|ΔP| / 50)     Δ in kPa
Pillar 10%:    same pillar full-scale 1.0 · same pillar chamber 0.8 · other 0.3
```

- A dimension NASA did not record contributes 0: no re-weighting and no guessing. Solid-material tables (SAFFIRE, BASS, BASS-II) never recorded pressure, so they cap at 85%.
- Ranges match anywhere inside the range. Discrete levels match only the listed levels, never the span between them.
- Each investigation is represented by its best-matching record.
- FLEX-2's planned condition envelopes are context only and are never ranked.
- Values that are physically implausible in the source (known NASA table typos) are withheld and flagged.
- Weights, the 0.4 / 0.3 fallbacks and the 65% threshold are provisional design choices, documented in the app's method panel.

Rankings and every number shown are computed deterministically in the browser from NASA's data. No SI model produces or reorders them.

## Known limits

- PSI has no partial-gravity combustion data. Microgravity results are not lunar or Martian results.
- Solid-material flammability tables don't record pressure. BASS-II logged airflow as fan settings, not cm/s.
- The Detection pillar (SAME / SAME-R smoke data) is not yet included.
- Thickness and flow direction are shown for comparison and are not scored. Gravity drives the hazard warning only.

## Run it

```bash
# data pipeline (Python 3.10+)
pip install -r requirements.txt
python scripts/fetch_psi.py          # pull NASA PSI investigations and experimental tables
python scripts/build_conditions.py   # canonical conditions with per-value status
python scripts/build_app_data.py     # web/public/data/pyrovector.json

# web app (Node 22+)
cd web
npm install
npm test
npm run dev                          # http://localhost:3000
```

## References and licences

- **Data:** NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov, CC0-1.0. Each investigation is cited in the app by its DOI.
- **Background (challenge resources):** NASA combustion science; A Researcher's Guide to ISS Combustion Science; Apollo 1, Apollo 13 and Mir fire records; NASA spinoffs on firefighter air tanks, smoke detection and protective clothing.
- **Software:** Next.js and React (MIT), Tailwind CSS (MIT), TypeScript (Apache-2.0), Python `requests` (Apache-2.0). Scaffold generated with `create-next-app`.
- No NASA logos or branding are used.


## Data pipeline details

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

### `conditions.csv` rules

- Every mapping from a table column to a canonical unit is explicit in `scripts/build_conditions.py`, so a reviewer can audit it.
- Status per value: `recorded`, `approx` (`~21.5`), `range` (`21.5 - 21.7`), `levels` (discrete list such as `21; 26.5; 40`; match against the listed levels, never the span between them), `footnote` (from a note printed with the table), `not_recorded`, `unparsed`, `suspect`.
- `not_recorded` means the PSI table has no such column. It is never guessed. Several tables (BASS, BASS-II, SAFFIRE, SAME) omit pressure.
- `suspect` means the value is physically implausible or ambiguous and is withheld, with the raw text kept. Known source typos: ACME BRE oxygen "3400%" / "2100%", SAFFIRE-II thickness "037 mm".
- A row is not always one test: ACME BRE rows are test days with several flames, and FLEX-2 rows are planned condition envelopes. Count them as records, not tests.
- PSI-142 (literature figure index) and the ground-only analysis investigations (PSI-60, 62, 115, 117) have no test conditions.

## Use of SI (to declare on the project page)

- The solution concept, product decisions and design choices are the team's own. SI was not used to come up with the idea.
- Written with help from Claude (Anthropic), an SI coding assistant:
  - data pipeline: the PSI data fetcher (`scripts/fetch_psi.py`), the conditions builder (`scripts/build_conditions.py`) and the app data bundle builder (`scripts/build_app_data.py`)
  - web app (`web/`): the BCMS scoring engine and cited-verdict logic (`web/src/lib/`), their unit tests (`web/tests/`) and the UI components (`web/src/components/`, `web/src/app/`)
- Codex (OpenAI), an SI coding assistant, reviewed the build plan and the finished UI. It also wrote the explanation-sentence fixes and numeric-firewall hardening in `web/src/lib/explain.ts`, with their regression tests (`web/tests/explain.test.ts`). The other fixes from its reviews were made with Claude.
- The Next.js project scaffold was generated by `create-next-app` (Vercel), a non-SI template tool.
- Every SI-assisted source file carries an `SI-assisted` header comment.
- Rankings, scores and every number shown in the app are computed deterministically from NASA's data. No SI model produces or reorders them.
