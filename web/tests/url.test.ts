// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchFromTarget, targetFromSearch } from "../src/lib/url.ts";
import type { Target } from "../src/lib/types.ts";

const MATS = new Set(["pmma", "sibal", "heptane"]);
const T: Target = { o2Pct: 30, pressureKPa: 70.3, flowCmS: 5, flowDirection: "opposed", materialKey: "pmma", thicknessMm: null, gravity: 0.16, pillar: "flammability" };

test("a target survives a round trip through the URL", () => {
  assert.deepEqual({ ...T, ...targetFromSearch(searchFromTarget(T), MATS) }, T);
});

test("invalid or out-of-range values are ignored", () => {
  const p = targetFromSearch("o2=500&kpa=-3&flow=abc&mat=uranium&g=0.5&dir=sideways&pillar=detection", MATS);
  assert.deepEqual(p, {});
});
