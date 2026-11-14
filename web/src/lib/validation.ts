// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Acceptance scenarios: what each one must show, re-checked live in the app (ValidationPanel) and in
// tests/validation.test.ts. Pure functions only, so the Node test runner can import this file.
import type { Bundle, Target } from "./types.ts";

export interface Scenario {
  id: string;
  label: string;
  /** What an engineer should see, in plain words. */
  expectation: string;
  query: string;
  expect: { best: string; ref: string; bcms: number; hazard: boolean };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "iss",
    label: "ISS cabin, SIBAL fabric, 20 cm/s",
    expectation: "Close NASA coverage: SAFFIRE-I matches at 84%, no hazard.",
    query: "pillar=flammability&o2=21&kpa=101.4&flow=20&dir=concurrent&mat=sibal&g=0",
    expect: { best: "SAFFIRE-I", ref: "S1", bcms: 84, hazard: false },
  },
  {
    id: "lunar-pmma",
    label: "Lunar base, PMMA, 5 cm/s",
    expectation: "Hazard: the best match is below 65% and was tested at a different oxygen level.",
    query: "pillar=flammability&o2=30&kpa=70.3&flow=5&dir=concurrent&mat=pmma&g=0",
    expect: { best: "SAFFIRE-II", ref: "2-7", bcms: 60.1, hazard: true },
  },
  {
    id: "lunar-silicone",
    label: "Lunar base, silicone, 20 cm/s",
    expectation: "Hazard from the oxygen gate alone, even though the match scores 72.7%.",
    query: "pillar=flammability&o2=30&kpa=70.3&flow=20&dir=opposed&mat=silicone&g=0",
    expect: { best: "SAFFIRE-II", ref: "2-2", bcms: 72.7, hazard: true },
  },
  {
    id: "exploration-nomex",
    label: "Exploration atmosphere (34% O₂, 8.2 psi), Nomex",
    expectation: "Hazard: the best-scoring match was tested near 22% O₂, far outside the ±2-point gate.",
    query: "pillar=flammability&o2=34&kpa=56.5&flow=20&dir=concurrent&mat=nomex&g=0",
    expect: { best: "SAFFIRE-II", ref: "2-7", bcms: 68.6, hazard: true },
  },
  {
    id: "lunar-heptane",
    label: "Lunar base, heptane droplet, Suppression",
    expectation: "Good coverage: FLEX was flown at 30% O₂ near this pressure, no hazard.",
    query: "pillar=suppression&o2=30&kpa=70.3&flow=0&dir=quiescent&mat=heptane&g=0",
    expect: { best: "FLEX", ref: "42", bcms: 77.7, hazard: false },
  },
  {
    id: "moon-gravity",
    label: "Moon gravity (0.16 g), SIBAL",
    expectation: "Hazard: PSI holds no partial-gravity combustion data.",
    query: "pillar=flammability&o2=30&kpa=70.3&flow=20&dir=concurrent&mat=sibal&g=0.16",
    expect: { best: "SAFFIRE-II", ref: "2-5", bcms: 72.7, hazard: true },
  },
  {
    id: "eva",
    label: "EVA suit, 100% O₂ at 4.3 psi",
    expectation: "Hazard: no NASA flammability test came near 100% O₂ (the highest is 40%).",
    query: "pillar=flammability&o2=100&kpa=29.6&flow=20&dir=concurrent&mat=sibal&g=0",
    expect: { best: "SAFFIRE-I", ref: "S1", bcms: 55.2, hazard: true },
  },
];

export interface ScenarioResult {
  pass: boolean;
  best: string | null;
  ref: string | null;
  bcms: number | null;
  hazard: boolean;
}

/** Re-run one scenario through the same engine the app uses (dependencies injected for testability). */
export function checkScenario(
  s: Scenario,
  bundle: Bundle,
  engine: {
    toTarget: (query: string) => Target;
    rank: (records: Bundle["records"], invs: Bundle["investigations"], t: Target) => { investigation: { acronym: string; pillar: string }; record: { ref: string }; bcms: number }[];
    hazard: (ranked: never[], t: Target) => { level: string } | null;
  },
): ScenarioResult {
  const t = engine.toTarget(s.query);
  const ranked = engine.rank(bundle.records, bundle.investigations, t);
  const best = ranked.find((r) => r.investigation.pillar === t.pillar) ?? null;
  const hz = engine.hazard(ranked as never[], t);
  const hazard = hz?.level === "hazard";
  const pass =
    !!best &&
    best.investigation.acronym === s.expect.best &&
    best.record.ref === s.expect.ref &&
    Math.abs(best.bcms - s.expect.bcms) < 0.05 &&
    hazard === s.expect.hazard;
  return { pass, best: best?.investigation.acronym ?? null, ref: best?.record.ref ?? null, bcms: best?.bcms ?? null, hazard };
}
