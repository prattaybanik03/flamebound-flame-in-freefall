// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Evidence Gap Atlas: coverage of NASA's PSI flammability corpus across the mission atmospheres in the
// challenge statement, for common cabin solids at two airflows. Every cell is computed by the same
// engine as the rest of the app; the headline finding and corpus facts are derived from the data,
// so the text cannot drift from the numbers. Dependencies are injected so tests need no extra imports.
import type { Bundle, Target } from "./types.ts";

export interface Atmosphere { id: string; label: string; o2Pct: number; pressureKPa: number; artemis: boolean }
export const ATMOSPHERES: Atmosphere[] = [
  { id: "iss", label: "ISS cabin", o2Pct: 21, pressureKPa: 101.4, artemis: false },
  { id: "lunar", label: "Lunar base / rover", o2Pct: 30, pressureKPa: 70.3, artemis: true },
  { id: "explore", label: "Exploration", o2Pct: 34, pressureKPa: 56.5, artemis: true },
  { id: "eva", label: "EVA suit", o2Pct: 100, pressureKPa: 29.6, artemis: true },
];
export const ATLAS_MATERIALS = ["sibal", "pmma", "nomex", "silicone", "kapton", "teflon", "pyrell", "lampwick"];
export const ATLAS_FLOWS = [5, 20];

export interface AtlasCell {
  atmosphere: Atmosphere;
  materialKey: string;
  flowCmS: number;
  target: Target;
  bcms: number;
  covered: boolean;
  best: { acronym: string; ref: string; o2Raw: string; material: string };
  /** Target O2 minus the best match's nearest recorded O2, in % points: positive means the target is above NASA's value. */
  dO2: number | null;
  pressureRecorded: boolean;
  /** True when the closest record tests this very material (not just a similar solid). */
  exactMaterial: boolean;
}

type Ranked = { investigation: { acronym: string; pillar: string }; record: { ref: string; material: string; o2: { raw: string; min: number | null; max: number | null; levels: number[] } }; bcms: number; components: { dim: string; delta: number | null; score: number | null }[] }[];
export interface Engine {
  rank: (records: Bundle["records"], invs: Bundle["investigations"], t: Target) => Ranked;
  hazard: (ranked: never[], t: Target) => { level: string } | null;
}

export function atlasTarget(a: Atmosphere, materialKey: string, flowCmS: number): Target {
  return { o2Pct: a.o2Pct, pressureKPa: a.pressureKPa, flowCmS, flowDirection: "concurrent", materialKey, thicknessMm: null, gravity: 0, pillar: "flammability" };
}

/** Signed distance from the target to the nearest value NASA recorded (0 inside a range). */
export function signedO2Gap(target: number, o2: { min: number | null; max: number | null; levels: number[] }): number {
  const points = o2.levels.length ? o2.levels : [];
  if (!points.length && o2.min !== null && o2.max !== null) {
    if (target >= o2.min && target <= o2.max) return 0;
    return Math.round((target > o2.max ? target - o2.max : target - o2.min) * 100) / 100;
  }
  const all = points.length ? points : [o2.min ?? o2.max ?? target];
  const nearest = all.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  return Math.round((target - nearest) * 100) / 100;
}

/** The headline shown in the page header (static, so it renders instantly). tests/atlas.test.ts
 *  recomputes it from the data at both airflows and fails if the engine ever disagrees. */
export const HEADLINE = { issCovered: 8, issTotal: 8, artemisCovered: 0, artemisTotal: 24 };

/** One configuration: the closest NASA flammability record and how well it covers the target. */
export function atlasCell(bundle: Bundle, engine: Engine, atmosphere: Atmosphere, materialKey: string, flowCmS: number): AtlasCell | null {
  const target = atlasTarget(atmosphere, materialKey, flowCmS);
  const ranked = engine.rank(bundle.records, bundle.investigations, target);
  const best = ranked.find((s) => s.investigation.pillar === "flammability");
  if (!best) return null;
  const o2 = best.components.find((c) => c.dim === "o2");
  const p = best.components.find((c) => c.dim === "pressure");
  const m = best.components.find((c) => c.dim === "material");
  const covered = engine.hazard(ranked as never[], target)?.level !== "hazard";
  const nearestO2 = o2?.delta === null || o2?.delta === undefined ? null : signedO2Gap(target.o2Pct, best.record.o2);
  return {
    atmosphere, materialKey, flowCmS, target, bcms: best.bcms, covered,
    best: { acronym: best.investigation.acronym, ref: best.record.ref, o2Raw: best.record.o2.raw, material: best.record.material },
    dO2: nearestO2,
    pressureRecorded: p?.score !== null && p?.score !== undefined,
    exactMaterial: m?.score === 1,
  };
}

export function computeAtlas(bundle: Bundle, engine: Engine): AtlasCell[] {
  const cells: AtlasCell[] = [];
  for (const flowCmS of ATLAS_FLOWS) {
    for (const materialKey of ATLAS_MATERIALS) {
      for (const atmosphere of ATMOSPHERES) {
        const cell = atlasCell(bundle, engine, atmosphere, materialKey, flowCmS);
        if (cell) cells.push(cell);
      }
    }
  }
  return cells;
}

export interface CorpusFacts { solidInvestigations: string[]; solidWithO2: string[]; solidO2Values: number; solidMinO2: number; solidMaxO2: number; solidPressureRecorded: number; surrogateMaxO2: number | null }

/** Facts about what NASA's solid-material flammability tables actually cover. */
export function corpusFacts(bundle: Bundle): CorpusFacts {
  const inv = new Map(bundle.investigations.map((i) => [i.id, i]));
  const solid = new Set<string>(); const withO2 = new Set<string>(); const o2: number[] = []; let pressure = 0; const surrogate: number[] = [];
  for (const r of bundle.records) {
    const i = inv.get(r.inv);
    if (!i || i.pillar !== "flammability") continue;
    const values = ["not_recorded", "unparsed", "suspect"].includes(r.o2.status)
      ? [] : [r.o2.min, r.o2.max, ...r.o2.levels].filter((v): v is number => v !== null);
    if (i.phase === "solid") {
      solid.add(i.acronym); o2.push(...values);
      if (values.length) withO2.add(i.acronym);
      if (!["not_recorded", "unparsed", "suspect"].includes(r.pressure.status)) pressure++;
    } else if (i.phase === "surrogate") surrogate.push(...values);
  }
  return {
    solidInvestigations: [...solid].sort(), solidWithO2: [...withO2].sort(), solidO2Values: o2.length,
    solidMinO2: Math.min(...o2), solidMaxO2: Math.max(...o2), solidPressureRecorded: pressure,
    surrogateMaxO2: surrogate.length ? Math.max(...surrogate) : null,
  };
}

export function summarise(cells: AtlasCell[]) {
  const iss = cells.filter((c) => !c.atmosphere.artemis);
  const artemis = cells.filter((c) => c.atmosphere.artemis);
  return {
    issCovered: iss.filter((c) => c.covered).length, issTotal: iss.length,
    artemisCovered: artemis.filter((c) => c.covered).length, artemisTotal: artemis.length,
  };
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every configuration, covered or not, so the gaps can be planned against. */
export function atlasCsv(cells: AtlasCell[], materialLabel: (k: string) => string, scenarioUrl: (t: Target) => string): string {
  const head = ["atmosphere", "o2_pct", "pressure_kpa", "airflow_cm_s", "material", "coverage_bcms_pct", "status",
    "nearest_nasa_record", "nearest_nasa_o2_cell", "o2_gap_pct_points", "pressure_recorded_by_nasa", "open_in_flamebound"];
  const rows = cells.map((c) => [c.atmosphere.label, c.atmosphere.o2Pct, c.atmosphere.pressureKPa, c.flowCmS, materialLabel(c.materialKey),
    c.bcms, c.covered ? "covered" : "gap", `${c.best.acronym} ${c.best.ref}`, c.best.o2Raw, c.dO2, c.pressureRecorded ? "yes" : "no", scenarioUrl(c.target)]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
