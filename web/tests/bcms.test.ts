// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Run: npm test   (Node's built-in test runner with TypeScript type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conditionDistance, rank, scoreRecord, hazard, bounds, REFUSAL_THRESHOLD } from "../src/lib/bcms.ts";
import { buildVerdict, NO_COMPARISON, GATED_MESSAGE } from "../src/lib/verdict.ts";
import type { Bundle, Target, Condition } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/pyrovector.json", import.meta.url), "utf8"));
const inv = (id: string) => bundle.investigations.find((i) => i.id === id)!;
const rec = (inv: string, ref: string) => bundle.records.find((r) => r.inv === inv && r.ref === ref)!;

const ISS: Target = {
  o2Pct: 21, pressureKPa: 101.3, flowCmS: 20, flowDirection: "concurrent",
  materialKey: "sibal", thicknessMm: null, gravity: 0, pillar: "flammability",
};

const cond = (p: Partial<Condition>): Condition => ({ min: null, max: null, levels: [], status: "recorded", raw: "", col: "", ...p });

test("range distance is 0 inside, edge distance outside", () => {
  const c = cond({ min: 21.5, max: 21.7, status: "range" });
  assert.equal(conditionDistance(c, 21.6), 0);
  assert.ok(Math.abs(conditionDistance(c, 20)! - 1.5) < 1e-9);
});

test("levels use nearest listed level, never the span", () => {
  const c = cond({ levels: [21, 26.5, 40], status: "levels", min: 21, max: 40 });
  assert.equal(conditionDistance(c, 30), 3.5); // nearest level 26.5, not 0 from being "inside" 21-40
});

test("not_recorded, suspect and unparsed contribute nothing", () => {
  for (const status of ["not_recorded", "suspect", "unparsed"] as const) {
    assert.equal(conditionDistance(cond({ min: 21, max: 21, status }), 21), null);
  }
});

test("SAFFIRE never reaches above 85% BCMS: pressure was not recorded", () => {
  const s = scoreRecord(rec("PSI-98", "S1"), inv("PSI-98"), ISS);
  const p = s.components.find((c) => c.dim === "pressure")!;
  assert.equal(p.score, null);
  assert.ok(s.bcms <= 85, `got ${s.bcms}`);
  assert.ok(Math.abs(s.coverage - 0.85) < 1e-9);
});

test("exact material, matched O2 and flow give a high score", () => {
  const s = scoreRecord(rec("PSI-98", "S1"), inv("PSI-98"), ISS);
  // O2 21.5-21.7 vs 21 -> d 0.5; flow 20 vs 20 -> d 0; exact SIBAL; full-scale flammability
  const expected = 100 * (0.3 * Math.exp(-0.5 / 15) + 0.25 * 1 + 0.2 * 1 + 0.1 * 1);
  assert.ok(Math.abs(s.bcms - Math.round(expected * 10) / 10) < 0.11, `got ${s.bcms}, expected ~${expected}`);
});

test("rank returns one best record per investigation, sorted desc", () => {
  const r = rank(bundle.records, bundle.investigations, ISS);
  const ids = r.map((x) => x.record.inv);
  assert.equal(new Set(ids).size, ids.length);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].bcms >= r[i].bcms);
  assert.match(r[0].investigation.acronym, /SAFFIRE/);
});

test("partial gravity always raises the extrapolation hazard", () => {
  const t: Target = { ...ISS, gravity: 0.16 };
  const h = hazard(rank(bundle.records, bundle.investigations, t), t);
  assert.equal(h?.level, "hazard");
  assert.match(h!.reasons.join(" "), /LUCI/);
});

test("lunar-base atmosphere with no close data triggers refusal below threshold", () => {
  const t: Target = { ...ISS, o2Pct: 100, pressureKPa: 29.6, materialKey: "nomex" };
  const r = rank(bundle.records, bundle.investigations, t);
  const h = hazard(r, t);
  if (r[0].bcms < REFUSAL_THRESHOLD) assert.equal(h?.level, "hazard");
});

test("bounds find recorded O2 below and above target within pillar", () => {
  const b = bounds(bundle.records, bundle.investigations, { ...ISS, o2Pct: 30 }, "o2");
  assert.ok(b.below && b.below.value <= 30);
  assert.ok(b.above && b.above.value >= 30);
});

test("verdict cites SAFFIRE-II rows for silicone with a record-specific reading", () => {
  const t: Target = { ...ISS, materialKey: "silicone" };
  const r = rank(bundle.records, bundle.investigations, t);
  const all = bundle.records.map((x) => scoreRecord(x, inv(x.inv), t));
  const v = buildVerdict(r, all, "silicone", hazard(r, t)?.level ?? null);
  assert.ok(v.available);
  assert.equal(v.gated, false);
  assert.ok(v.evidence.every((e) => e.investigationId === "PSI-99" && e.doi.length > 0));
  assert.ok(v.evidence.some((e) => e.reading?.includes("at these test conditions")));
  assert.ok(v.evidence.every((e) => e.targetDeltas.length === 3));
});

test("a non-gravity written finding never makes a verdict available (Kapton)", () => {
  const t: Target = { ...ISS, materialKey: "kapton" };
  const r = rank(bundle.records, bundle.investigations, t);
  const all = bundle.records.map((x) => scoreRecord(x, inv(x.inv), t));
  const v = buildVerdict(r, all, "kapton", hazard(r, t)?.level ?? null);
  assert.equal(v.available, false);
  assert.equal(v.message, NO_COMPARISON);
});

test("hazard gates the verdict: lunar-base silicone shows observations, no target conclusion", () => {
  const t: Target = { ...ISS, o2Pct: 30, pressureKPa: 70.3, flowCmS: 5, materialKey: "silicone" };
  const r = rank(bundle.records, bundle.investigations, t);
  const all = bundle.records.map((x) => scoreRecord(x, inv(x.inv), t));
  const v = buildVerdict(r, all, "silicone", hazard(r, t)?.level ?? null);
  assert.equal(v.gated, true);
  assert.equal(v.message, GATED_MESSAGE);
});

test("n/a and noted values are unknown, never 'did not burn'", () => {
  const t: Target = { ...ISS, materialKey: "pmma" };
  const all = bundle.records.map((x) => scoreRecord(x, inv(x.inv), t));
  const v = buildVerdict([], all, "pmma", null);
  // PMMA rows hold qualified values ("~ 10 cm (note 3)", "~ 0 (Nomex)"): no reading may be produced
  assert.ok(v.evidence.every((e) => e.reading === null));
});

test("planned envelopes (FLEX-2) are never ranked", () => {
  const t: Target = { ...ISS, o2Pct: 30, pressureKPa: 70.3, flowCmS: 5, materialKey: "pmma" };
  const r = rank(bundle.records, bundle.investigations, t);
  assert.ok(!r.some((s) => s.investigation.plannedEnvelope));
});

test("refusal threshold uses the active pillar: lunar-base PMMA flammability raises the hazard", () => {
  const t: Target = { ...ISS, o2Pct: 30, pressureKPa: 70.3, flowCmS: 5, materialKey: "pmma" };
  const r = rank(bundle.records, bundle.investigations, t);
  const bestFlam = r.find((s) => s.investigation.pillar === "flammability")!;
  assert.ok(bestFlam.bcms < REFUSAL_THRESHOLD);
  assert.equal(hazard(r, t)?.level, "hazard");
});

const thicknessFact = (v: ReturnType<typeof buildVerdict>, ref: string) =>
  v.evidence.find((e) => e.recordRef === ref)?.facts.find((f) => f.label.startsWith("Thickness"));

test("suspect source values keep their status in verdict facts (default SIBAL 2-5, 2-6)", () => {
  const r = rank(bundle.records, bundle.investigations, ISS);
  const all = bundle.records.map((x) => scoreRecord(x, inv(x.inv), ISS));
  const v = buildVerdict(r, all, "sibal", hazard(r, ISS)?.level ?? null);
  for (const ref of ["2-5", "2-6"]) {
    const f = thicknessFact(v, ref);
    assert.ok(f, `SAFFIRE-II ${ref} thickness fact present`);
    assert.equal(f.status, "suspect");
    assert.equal(f.value, "037 mm"); // raw kept for audit, never normalised
  }
});

test("suspect thickness on Silicone 2-4 is flagged; recorded 2-1 is not", () => {
  const t: Target = { ...ISS, materialKey: "silicone" };
  const r = rank(bundle.records, bundle.investigations, t);
  const all = bundle.records.map((x) => scoreRecord(x, inv(x.inv), t));
  const v = buildVerdict(r, all, "silicone", hazard(r, t)?.level ?? null);
  assert.equal(thicknessFact(v, "2-4")?.status, "suspect");
  assert.equal(thicknessFact(v, "2-1")?.status, "recorded");
});

test("partial-gravity warning never claims microgravity/1 g results bound the case", () => {
  const t: Target = { ...ISS, gravity: 0.16 };
  const h = hazard(rank(bundle.records, bundle.investigations, t), t)!;
  const text = h.reasons.join(" ");
  assert.ok(!/bound this case/i.test(text));
  assert.match(text, /contextual evidence/);
  assert.match(text, /LUCI/);
  assert.match(text, /FM2/);
});

test("O2 gate: lunar-base silicone (best match tested ~8.5 % pts lower) raises the hazard", () => {
  const t: Target = { ...ISS, o2Pct: 30, pressureKPa: 70.3, flowCmS: 20, materialKey: "silicone" };
  const r = rank(bundle.records, bundle.investigations, t);
  const best = r.find((s) => s.investigation.pillar === "flammability")!;
  assert.ok(best.bcms >= REFUSAL_THRESHOLD, `precondition: score alone would pass (${best.bcms})`);
  const h = hazard(r, t);
  assert.equal(h?.level, "hazard");
  assert.match(h!.reasons.join(" "), /atmosphere-class gate/);
});

test("O2 gate: ISS + SIBAL stays clean (SAFFIRE-I within 2 % pts)", () => {
  assert.equal(hazard(rank(bundle.records, bundle.investigations, ISS), ISS), null);
});

test("O2 gate: lunar suppression with heptane stays clean (FLEX recorded at 30% O2)", () => {
  const t: Target = { ...ISS, o2Pct: 30, pressureKPa: 70.3, flowCmS: 0, materialKey: "heptane", pillar: "suppression" };
  assert.equal(hazard(rank(bundle.records, bundle.investigations, t), t), null);
});
