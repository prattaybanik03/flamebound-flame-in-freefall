// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Self-audit helper (ours, not independent). Run from the repository root:
//   node --experimental-strip-types docs/audit/run_baseline.mts
// Writes docs/audit/scenario_top.json (top flammability match per acceptance scenario, used by
// check_sources.py) and docs/audit/baseline_atlas_64.csv (BCMS vs a simple baseline on all 64 Atlas cells).
// Baseline: keep flammability records with a usable oxygen value; if any record tests the exact material,
// pick the one with the smallest oxygen gap (ties: nearest airflow), else the nearest-oxygen solid record.
// "Covered" for the baseline means an exact-material record within 2 percentage points of oxygen.
import { readFileSync, writeFileSync } from "node:fs";
import { rank, hazard } from "../../web/src/lib/bcms.ts";
import { targetFromSearch } from "../../web/src/lib/url.ts";
import { SCENARIOS } from "../../web/src/lib/validation.ts";
import { computeAtlas, signedO2Gap } from "../../web/src/lib/atlas.ts";

const here = new URL(".", import.meta.url);
const bundle: any = JSON.parse(readFileSync(new URL("../../web/public/data/flamebound.json", import.meta.url), "utf8"));
const inv = new Map<string, any>(bundle.investigations.map((i: any) => [i.id, i]));
const engine: any = { rank, hazard };
const usable = (c: any) => !["not_recorded", "unparsed", "suspect"].includes(c.status) && (c.min !== null || c.levels.length > 0);
const gap = (t: number, o: any) => Math.abs(signedO2Gap(t, o));

function baseline(t: any) {
  const flam = bundle.records.filter((r: any) => {
    const i = inv.get(r.inv);
    return i && i.pillar === "flammability" && !i.plannedEnvelope && i.phase !== "surrogate" && usable(r.o2);
  });
  const exact = flam.filter((r: any) => r.materialKeys.includes(t.materialKey));
  const pool = exact.length ? exact : flam.filter((r: any) => inv.get(r.inv).phase === "solid");
  const flowGap = (r: any) => (r.flow.min === null ? 5 : Math.abs(r.flow.min - t.flowCmS));
  const best = pool.reduce((a: any, b: any) => {
    const ga = gap(t.o2Pct, a.o2), gb = gap(t.o2Pct, b.o2);
    return gb < ga || (gb === ga && flowGap(b) < flowGap(a)) ? b : a;
  });
  const g = gap(t.o2Pct, best.o2);
  return { rec: best, gap: g, exactFound: exact.length > 0, covered: exact.length > 0 && g <= 2 };
}

// 1) Top match per acceptance scenario (input to check_sources.py)
const DEF = { o2Pct: 21, pressureKPa: 101.4, flowCmS: 20, flowDirection: "concurrent", materialKey: "sibal", thicknessMm: null, gravity: 0, pillar: "flammability" };
const mats = new Set(bundle.records.flatMap((r: any) => r.materialKeys));
const top: any[] = [];
for (const s of SCENARIOS) {
  const t: any = { ...DEF, ...targetFromSearch(s.query, mats) };
  const ranked: any[] = rank(bundle.records, bundle.investigations, t);
  const best = ranked.find((x) => x.investigation.pillar === t.pillar)!;
  const r = best.record;
  top.push({ id: s.id, label: s.label, inv: best.investigation.id, acr: best.investigation.acronym, bcms: best.bcms,
    hazard: (hazard(ranked as any, t) as any)?.level === "hazard",
    rec: { table: r.table, row: r.row, ref: r.ref, material: r.material, o2: r.o2, flow: r.flow, pressure: r.pressure } });
}
writeFileSync(new URL("scenario_top.json", here), JSON.stringify(top, null, 1) + "\n");

// 2) BCMS vs baseline on all 64 Atlas cells
const q = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const head = ["atmosphere", "o2_pct", "airflow_cm_s", "material", "bcms_label", "bcms_best_record", "bcms_best_matches_exact_material",
  "baseline_label", "baseline_record", "baseline_o2_gap_pct_points", "labels_agree"];
const rows: any[][] = []; let agree = 0;
for (const c of computeAtlas(bundle, engine)) {
  const b = baseline(c.target);
  const bl = b.covered ? "covered" : "gap", ml = c.covered ? "covered" : "gap";
  if (bl === ml) agree++;
  rows.push([c.atmosphere.label, c.atmosphere.o2Pct, c.flowCmS, c.materialKey, ml, `${c.best.acronym} ${c.best.ref}`, c.exactMaterial,
    bl, `${inv.get(b.rec.inv).acronym} ${b.rec.ref}`, b.gap, bl === ml]);
}
writeFileSync(new URL("baseline_atlas_64.csv", here), [head, ...rows].map((r) => r.map(q).join(",")).join("\n") + "\n");
console.log(`Atlas cells: ${rows.length}; same coverage label: ${agree}; different: ${rows.length - agree}`);
