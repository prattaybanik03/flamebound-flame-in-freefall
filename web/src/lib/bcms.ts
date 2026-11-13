// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Boundary Condition Match Score (BCMS), implementing the locked spec in
// agents/DECISIONS.md:
//
//   BCMS = 100 * sum over RECORDED dimensions k of (w_k * s_k)
//   w: O2 0.30, material 0.25, flow 0.20, pressure 0.15, pillar/scale 0.10
//   s_O2 = exp(-|dO2|/15) [% pts], s_flow = exp(-|dV|/15) [cm/s], s_P = exp(-|dP|/50) [kPa]
//
// A dimension NASA did not record (not_recorded / unparsed / suspect) contributes 0.
// Nothing here guesses a value. The LLM never touches this ranking.

import type { Condition, Investigation, Phase, Pillar, PsiRecord, Target } from "./types";

export const WEIGHTS = { o2: 0.3, material: 0.25, flow: 0.2, pressure: 0.15, pillar: 0.1 } as const;
export const SCALES = { o2: 15, flow: 15, pressure: 50 } as const; // % pts, cm/s, kPa

// PROVISIONAL constants, flagged in agents/DECISIONS.md for Pratt to confirm.
export const MATERIAL_SCORES = { exact: 1.0, surrogate: 0.9, samePhase: 0.75, other: 0.4 } as const;
export const PILLAR_SCORES = { fullScale: 1.0, chamber: 0.8, mismatch: 0.3 } as const;
export const REFUSAL_THRESHOLD = 65;

const USABLE = new Set(["recorded", "approx", "range", "levels", "footnote"]);

export const MATERIAL_PHASE: Record<string, Exclude<Phase, "surrogate">> = {
  sibal: "solid", pmma: "solid", nomex: "solid", silicone: "solid", kapton: "solid",
  teflon: "solid", pyrell: "solid", lampwick: "solid", wax: "solid", ultem: "solid",
  heptane: "liquid", methanol: "liquid", ethanol: "liquid", decane: "liquid",
  octane: "liquid", dodecane: "liquid",
  ethylene: "gas", methane: "gas", ethane: "gas", propane: "gas", propylene: "gas",
  butane: "gas", hydrogen: "gas",
};

export type Dim = "o2" | "material" | "flow" | "pressure" | "pillar";

export interface Component {
  dim: Dim;
  weight: number;
  /** 0..1 sub-score, or null when NASA did not record this dimension (contributes 0). */
  score: number | null;
  /** Absolute distance to the target in canonical units (o2/flow/pressure only). */
  delta: number | null;
  /** Human-readable basis, e.g. "Exact material match" or the raw cell. */
  basis: string;
  status?: string;
  raw?: string;
  col?: string;
}

export interface Scored {
  record: PsiRecord;
  investigation: Investigation;
  bcms: number; // 0..100
  components: Component[];
  /** Share of total weight actually backed by recorded data (0..1). */
  coverage: number;
}

/** Distance from a target value to a NASA condition, or null if not usable. */
export function conditionDistance(c: Condition, target: number): number | null {
  if (!USABLE.has(c.status)) return null;
  if (c.levels.length > 0) {
    // Discrete levels: nearest listed level, never the span between them.
    return Math.min(...c.levels.map((l) => Math.abs(l - target)));
  }
  if (c.min === null || c.max === null) return null;
  if (target >= c.min && target <= c.max) return 0;
  return Math.min(Math.abs(target - c.min), Math.abs(target - c.max));
}

function conditionComponent(dim: "o2" | "flow" | "pressure", c: Condition, target: number): Component {
  const d = conditionDistance(c, target);
  return {
    dim,
    weight: WEIGHTS[dim],
    score: d === null ? null : Math.exp(-d / SCALES[dim]),
    delta: d,
    basis: d === null ? notRecordedReason(c) : c.raw || c.col,
    status: c.status,
    raw: c.raw,
    col: c.col,
  };
}

function notRecordedReason(c: Condition): string {
  switch (c.status) {
    case "not_recorded": return "Not recorded in NASA's table";
    case "suspect": return `Withheld: implausible source value "${c.raw}"`;
    case "unparsed": return `Unparseable source value "${c.raw}"`;
    default: return "Not available";
  }
}

export function materialComponent(r: PsiRecord, inv: Investigation, targetKey: string): Component {
  const targetPhase = MATERIAL_PHASE[targetKey];
  const recordPhase: Phase = inv.phase === "surrogate" ? "gas" : inv.phase;
  let score: number | null;
  let basis: string;
  if (r.materialKeys.includes(targetKey)) {
    score = MATERIAL_SCORES.exact; basis = "Exact material match";
  } else if (inv.phase === "surrogate" && targetPhase === "solid") {
    score = MATERIAL_SCORES.surrogate; basis = "Calibrated condensed-fuel surrogate (gas burner)";
  } else if (!r.material && r.materialKeys.length === 0) {
    score = null; basis = "Material not recorded in NASA's table";
  } else if (recordPhase === targetPhase) {
    score = MATERIAL_SCORES.samePhase; basis = `Same fuel phase (${targetPhase})`;
  } else {
    score = MATERIAL_SCORES.other; basis = `Different fuel phase (${recordPhase} vs ${targetPhase})`;
  }
  return { dim: "material", weight: WEIGHTS.material, score, delta: null, basis, raw: r.material };
}

export function pillarComponent(inv: Investigation, pillar: Exclude<Pillar, "fundamentals">): Component {
  let score: number; let basis: string;
  if (inv.pillar === pillar) {
    score = inv.scale === "full" ? PILLAR_SCORES.fullScale : PILLAR_SCORES.chamber;
    basis = inv.scale === "full" ? "Same pillar, full-scale vehicle test" : "Same pillar, chamber test";
  } else {
    score = PILLAR_SCORES.mismatch; basis = `Different pillar (${inv.pillar})`;
  }
  return { dim: "pillar", weight: WEIGHTS.pillar, score, delta: null, basis };
}

export function scoreRecord(r: PsiRecord, inv: Investigation, t: Target): Scored {
  const components: Component[] = [
    conditionComponent("o2", r.o2, t.o2Pct),
    materialComponent(r, inv, t.materialKey),
    conditionComponent("flow", r.flow, t.flowCmS),
    conditionComponent("pressure", r.pressure, t.pressureKPa),
    pillarComponent(inv, t.pillar),
  ];
  const sum = components.reduce((acc, c) => acc + (c.score === null ? 0 : c.weight * c.score), 0);
  const coverage = components.reduce((acc, c) => acc + (c.score === null ? 0 : c.weight), 0);
  return { record: r, investigation: inv, bcms: round1(100 * sum), components, coverage };
}

export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Score every record; return the best record per investigation, best first. */
export function rank(records: PsiRecord[], invs: Investigation[], t: Target): Scored[] {
  const byId = new Map(invs.map((i) => [i.id, i]));
  const best = new Map<string, Scored>();
  for (const r of records) {
    const inv = byId.get(r.inv);
    if (!inv || inv.plannedEnvelope) continue; // planned envelopes are context only (locked Sat 11:20)
    const s = scoreRecord(r, inv, t);
    const cur = best.get(r.inv);
    if (!cur || s.bcms > cur.bcms) best.set(r.inv, s);
  }
  return [...best.values()].sort((a, b) => b.bcms - a.bcms || a.record.inv.localeCompare(b.record.inv));
}

export interface Hazard {
  level: "hazard" | "info";
  reasons: string[];
}

/** Extrapolation Hazard banner logic (P5). Null when no banner is needed. */
export function hazard(ranked: Scored[], t: Target): Hazard | null {
  const reasons: string[] = [];
  if (t.gravity === 0.16 || t.gravity === 0.38) {
    reasons.push(
      `PSI contains no partial-gravity combustion data (${t.gravity === 0.16 ? "Moon, 0.16 g" : "Mars, 0.38 g"}). ` +
        "Microgravity and 1 g results only bound this case. Partial-gravity data is expected from NASA's LUCI and FM2 experiments.",
    );
  }
  // Threshold checks the best match in the ACTIVE pillar (locked Sat 11:20), so a record
  // from another pillar can never 'clear' the engineer's question.
  const top = ranked.find((s) => s.investigation.pillar === t.pillar)?.bcms ?? 0;
  if (top < REFUSAL_THRESHOLD) {
    reasons.push(`Best ${t.pillar} match is ${top}% BCMS, below the ${REFUSAL_THRESHOLD}% threshold: NASA's data does not cover this cabin state closely enough to support a verdict.`);
  }
  if (reasons.length) return { level: "hazard", reasons };
  if (t.gravity === 1) {
    return { level: "info", reasons: ["All PSI flight data is microgravity. 1 g behaviour is the domain of NASA-STD-6001 ground testing; matches below show microgravity counterparts."] };
  }
  return null;
}

export interface Bound {
  scored: Scored;
  value: number;
}

/**
 * Nearest recorded records below and above the target for one condition,
 * within the target pillar. Used by the hazard banner to show exact deltas.
 */
export function bounds(
  records: PsiRecord[], invs: Investigation[], t: Target, dim: "o2" | "flow" | "pressure",
): { below: Bound | null; above: Bound | null } {
  const byId = new Map(invs.map((i) => [i.id, i]));
  const target = dim === "o2" ? t.o2Pct : dim === "flow" ? t.flowCmS : t.pressureKPa;
  let below: Bound | null = null;
  let above: Bound | null = null;
  for (const r of records) {
    const inv = byId.get(r.inv);
    if (!inv || inv.pillar !== t.pillar || inv.plannedEnvelope) continue;
    const c = r[dim];
    if (!USABLE.has(c.status)) continue;
    const vals = c.levels.length ? c.levels : [c.min, c.max].filter((v): v is number => v !== null);
    for (const v of vals) {
      if (v <= target && (!below || v > below.value)) below = { scored: scoreRecord(r, inv, t), value: v };
      if (v >= target && (!above || v < above.value)) above = { scored: scoreRecord(r, inv, t), value: v };
    }
  }
  return { below, above };
}
