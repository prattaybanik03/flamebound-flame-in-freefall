// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rank, hazard } from "../src/lib/bcms.ts";
import { numericFirewall } from "../src/lib/explain.ts";
import { buildEvidence, validateBrief, fallbackBrief, splitSentences } from "../src/lib/brief.ts";
import type { Bundle, Target } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/pyrovector.json", import.meta.url), "utf8"));
const ISS: Target = { o2Pct: 21, pressureKPa: 101.4, flowCmS: 20, flowDirection: "concurrent", materialKey: "sibal", thicknessMm: null, gravity: 0, pillar: "flammability" };
const LUNAR: Target = { ...ISS, o2Pct: 30, pressureKPa: 70.3, flowCmS: 20, materialKey: "silicone" };
const pack = (t: Target) => { const r = rank(bundle.records, bundle.investigations, t); return buildEvidence(r, t, hazard(r, t), "test material"); };

test("evidence pack holds only active-pillar records, with verbatim NASA cells", () => {
  const p = pack(ISS);
  assert.equal(p.evidence[0].investigation, "SAFFIRE-I");
  assert.ok(p.evidence.length <= 4);
  assert.equal(p.evidence[0].conditions.find((c) => c.name === "oxygen")?.nasaCell, "21.5 - 21.7");
  assert.equal(p.hazard.length, 0);
});

test("a grounded, cited draft passes", () => {
  const p = pack(ISS);
  const text = "The closest NASA evidence is SAFFIRE-I S1, which scores 84% BCMS for SIBAL fabric at 20 cm/s [E1]. NASA did not record pressure for this test [E1].";
  const v = validateBrief(text, p, numericFirewall);
  assert.deepEqual(v.problems, []);
  assert.equal(v.sentences.length, 2);
});

test("an uncited sentence, an invented number and an unknown citation are all rejected", () => {
  const p = pack(ISS);
  const v = validateBrief("SAFFIRE-I burned for 999 seconds. It is relevant [E9].", p, numericFirewall);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((x) => x.includes("no citation")));
  assert.ok(v.problems.some((x) => x.includes("999")));
  assert.ok(v.problems.some((x) => x.includes("E9")));
});

test("safety verdicts are rejected", () => {
  const p = pack(ISS);
  const v = validateBrief("SIBAL is safe for this cabin [E1].", p, numericFirewall);
  assert.ok(v.problems.some((x) => x.includes("verdict")));
});

test("with an active hazard, the first sentence must state the coverage gap", () => {
  const p = pack(LUNAR);
  assert.ok(p.hazard.length > 0);
  const bad = validateBrief("SAFFIRE-II tested silicone [E1].", p, numericFirewall);
  assert.ok(bad.problems.some((x) => x.includes("coverage gap")));
  const good = validateBrief("NASA's data does not closely cover a 30% oxygen cabin for silicone [E1].", p, numericFirewall);
  assert.deepEqual(good.problems, []);
});

test("fallback brief cites evidence and leads with the hazard", () => {
  const f = fallbackBrief(pack(LUNAR));
  assert.match(f[0].text, /does not closely cover/);
  assert.ok(f.every((s) => s.cites.length > 0));
});

test("sentence splitter keeps trailing citations with their sentence", () => {
  const s = splitSentences("First point [E1]. Second point [E1][E2].");
  assert.equal(s.length, 2);
  assert.deepEqual(s[1].cites, ["E1", "E2"]);
});
