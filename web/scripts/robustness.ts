// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Robustness check for the BCMS weights. Each weight is scaled by 0.8 and 1.2 (then all weights
// are renormalised to sum to 1) across six engineering scenarios. Reports how often the top
// active-pillar match, the top-3 order, and the hazard decision stay the same.
// Run: npm run robustness
import { readFileSync } from "node:fs";
import { WEIGHTS, rank, hazard, type Weights } from "../src/lib/bcms.ts";
import type { Bundle, Target } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/flamebound.json", import.meta.url), "utf8"));
const base: Target = { o2Pct: 21, pressureKPa: 101.4, flowCmS: 20, flowDirection: "concurrent", materialKey: "sibal", thicknessMm: null, gravity: 0, pillar: "flammability" };
const SCENARIOS: Record<string, Partial<Target>> = {
  "ISS, SIBAL, 20 cm/s (flammability)": {},
  "Lunar base, PMMA, 5 cm/s (flammability)": { o2Pct: 30, pressureKPa: 70.3, flowCmS: 5, materialKey: "pmma" },
  "Exploration, Nomex, 10 cm/s (flammability)": { o2Pct: 34, pressureKPa: 56.5, flowCmS: 10, materialKey: "nomex" },
  "Lunar base, silicone, 20 cm/s (flammability)": { o2Pct: 30, pressureKPa: 70.3, flowCmS: 20, materialKey: "silicone" },
  "Lunar base, heptane, 0 cm/s (suppression)": { o2Pct: 30, pressureKPa: 70.3, flowCmS: 0, materialKey: "heptane", pillar: "suppression" },
  "ISS, methanol, 0 cm/s (suppression)": { flowCmS: 0, materialKey: "methanol", pillar: "suppression" },
};

function summarise(t: Target, w: Weights) {
  const ranked = rank(bundle.records, bundle.investigations, t, w);
  const inPillar = ranked.filter((s) => s.investigation.pillar === t.pillar);
  return {
    top: inPillar[0]?.investigation.acronym ?? "-",
    top3: inPillar.slice(0, 3).map((s) => s.investigation.acronym).join(", "),
    hazard: hazard(ranked, t)?.level === "hazard",
  };
}

const dims = Object.keys(WEIGHTS) as (keyof Weights)[];
let total = 0, sameTop = 0, sameTop3 = 0, sameHazard = 0;
const changes: string[] = [];
for (const [name, patch] of Object.entries(SCENARIOS)) {
  const t = { ...base, ...patch };
  const ref = summarise(t, { ...WEIGHTS });
  console.log(`${name}\n  top: ${ref.top} | top 3: ${ref.top3} | hazard: ${ref.hazard ? "yes" : "no"}`);
  for (const d of dims) for (const f of [0.8, 1.2]) {
    const w = { ...WEIGHTS, [d]: WEIGHTS[d] * f } as Weights;
    const sum = dims.reduce((a, k) => a + w[k], 0);
    for (const k of dims) w[k] = w[k] / sum;
    const r = summarise(t, w);
    total++;
    if (r.top === ref.top) sameTop++; else changes.push(`  ${name}: ${d} x${f} -> top ${ref.top} becomes ${r.top}`);
    if (r.top3 === ref.top3) sameTop3++;
    if (r.hazard === ref.hazard) sameHazard++; else changes.push(`  ${name}: ${d} x${f} -> hazard ${ref.hazard} becomes ${r.hazard}`);
  }
}
console.log(`\n${total} perturbations (5 weights x {0.8, 1.2} x ${Object.keys(SCENARIOS).length} scenarios, renormalised)`);
console.log(`Top match unchanged:     ${sameTop}/${total}`);
console.log(`Top-3 order unchanged:   ${sameTop3}/${total}`);
console.log(`Hazard decision unchanged: ${sameHazard}/${total}`);
if (changes.length) console.log("Changes:\n" + changes.join("\n"));
