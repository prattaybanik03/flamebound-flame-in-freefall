// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rank, hazard } from "../src/lib/bcms.ts";
import { HEADLINE, atlasCsv, computeAtlas, corpusFacts, signedO2Gap, summarise } from "../src/lib/atlas.ts";
import type { Bundle } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/flamebound.json", import.meta.url), "utf8"));
const cells = computeAtlas(bundle, { rank, hazard: hazard as never });

test("the headline finding: ISS covered for every material, no Artemis atmosphere covered", () => {
  const s = summarise(cells);
  assert.equal(cells.length, 64);
  assert.equal(s.issCovered, s.issTotal);
  assert.equal(s.artemisCovered, 0);
  assert.equal(s.artemisTotal, 48);
});

test("corpus fact: every solid flammability test in PSI is at or below 22.2% O2, none with pressure", () => {
  const f = corpusFacts(bundle);
  assert.deepEqual(f.solidInvestigations, ["BASS", "BASS-II", "SAFFIRE-I", "SAFFIRE-II", "SAFFIRE-III"]);
  assert.deepEqual(f.solidWithO2, ["BASS-II", "SAFFIRE-I", "SAFFIRE-II"]);
  assert.equal(f.solidMinO2, 13.6);
  assert.equal(f.solidMaxO2, 22.2);
  assert.equal(f.solidPressureRecorded, 0);
  assert.equal(f.surrogateMaxO2, 40);
});

test("gap cells carry real scores and O2 distances, not placeholders", () => {
  const lunar = cells.find((c) => c.atmosphere.id === "lunar" && c.materialKey === "silicone" && c.flowCmS === 20)!;
  assert.equal(lunar.bcms, 72.7);
  assert.equal(lunar.covered, false);
  assert.ok(lunar.dO2 !== null && Math.abs(lunar.dO2 - 7.9) < 0.05, String(lunar.dO2));
});

test("CSV lists all 64 configurations with a link to each", () => {
  const csv = atlasCsv(cells, (k) => k, (t) => `https://x/?o2=${t.o2Pct}`);
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 65);
  assert.match(lines[0], /^atmosphere,o2_pct,pressure_kpa/);
  assert.ok(lines.slice(1).some((l) => l.includes(",gap,")));
});

test("the static header headline matches the engine at every airflow", () => {
  for (const flow of [5, 20]) assert.deepEqual(summarise(cells.filter((c) => c.flowCmS === flow)), HEADLINE);
});

test("O2 gaps keep their direction", () => {
  assert.equal(signedO2Gap(21, { min: 21.5, max: 21.7, levels: [] }), -0.5);
  assert.equal(signedO2Gap(30, { min: 22.1, max: 22.1, levels: [] }), 7.9);
  assert.equal(signedO2Gap(30, { min: 21, max: 40, levels: [21, 26.5, 40] }), 3.5);
  assert.equal(signedO2Gap(21.6, { min: 21.5, max: 21.7, levels: [] }), 0);
});
