// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Shareable scenarios: the target is encoded in the URL query so a judge (or a slide) can open
// an exact scenario in one click. Every parameter is validated; anything invalid falls back to
// the default, so a hand-edited link can never produce an out-of-range target.
import type { FlowDirection, Gravity, Target } from "./types";

const PILLARS = ["flammability", "suppression"] as const;
const DIRECTIONS: FlowDirection[] = ["opposed", "concurrent", "coflow", "quiescent"];
const GRAVITIES: Gravity[] = [0, 0.16, 0.38, 1];

function num(v: string | null, min: number, max: number): number | undefined {
  if (v === null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/**
 * Parse a query string into a partial target. Unknown or invalid values are ignored.
 * `materials` is the set of allowed material keys (MATERIAL_OPTIONS in presets.ts).
 */
export function targetFromSearch(search: string, materials: ReadonlySet<string>): Partial<Target> {
  const q = new URLSearchParams(search);
  const out: Partial<Target> = {};
  const pillar = q.get("pillar");
  if (pillar && (PILLARS as readonly string[]).includes(pillar)) out.pillar = pillar as Target["pillar"];
  const o2 = num(q.get("o2"), 10, 100);
  if (o2 !== undefined) out.o2Pct = o2;
  const kpa = num(q.get("kpa"), 20, 320);
  if (kpa !== undefined) out.pressureKPa = kpa;
  const flow = num(q.get("flow"), 0, 50);
  if (flow !== undefined) out.flowCmS = flow;
  const dir = q.get("dir");
  if (dir && (DIRECTIONS as string[]).includes(dir)) out.flowDirection = dir as FlowDirection;
  const mat = q.get("mat");
  if (mat && materials.has(mat)) out.materialKey = mat;
  const g = num(q.get("g"), 0, 1);
  if (g !== undefined && (GRAVITIES as number[]).includes(g)) out.gravity = g as Gravity;
  const th = num(q.get("th"), 0, 1000);
  if (th !== undefined) out.thicknessMm = th;
  return out;
}

/** Encode a target as a query string (without the leading "?"). */
export function searchFromTarget(t: Target): string {
  const q = new URLSearchParams({
    pillar: t.pillar,
    o2: String(t.o2Pct),
    kpa: String(Math.round(t.pressureKPa * 10) / 10),
    flow: String(t.flowCmS),
    dir: t.flowDirection,
    mat: t.materialKey,
    g: String(t.gravity),
  });
  if (t.thicknessMm !== null) q.set("th", String(t.thicknessMm));
  return q.toString();
}
