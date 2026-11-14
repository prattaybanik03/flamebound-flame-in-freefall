// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rank, hazard } from "../src/lib/bcms.ts";
import { targetFromSearch } from "../src/lib/url.ts";
import { SCENARIOS, checkScenario } from "../src/lib/validation.ts";
import type { Bundle, Target } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/flamebound.json", import.meta.url), "utf8"));
const DEF: Target = { o2Pct: 21, pressureKPa: 101.4, flowCmS: 20, flowDirection: "concurrent", materialKey: "sibal", thicknessMm: null, gravity: 0, pillar: "flammability" };
const mats = new Set(bundle.records.flatMap((r) => r.materialKeys));
const engine = { toTarget: (q: string) => ({ ...DEF, ...targetFromSearch(q, mats) }), rank, hazard: hazard as never };

for (const s of SCENARIOS) {
  test(`acceptance scenario: ${s.label}`, () => {
    const r = checkScenario(s, bundle, engine);
    assert.ok(r.pass, `${s.id}: got ${r.best} ${r.ref} ${r.bcms}% hazard=${r.hazard}`);
  });
}
