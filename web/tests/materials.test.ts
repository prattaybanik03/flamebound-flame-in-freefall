// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rank, hazard } from "../src/lib/bcms.ts";
import { ATMOSPHERES, atlasCell, type Atmosphere } from "../src/lib/atlas.ts";
import { MAX_ROWS, checkCsv, checkMaterials, matchMaterial, parseMaterials, summariseRows } from "../src/lib/materials.ts";
import type { Bundle } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/flamebound.json", import.meta.url), "utf8"));
const engine = { rank, hazard: hazard as never };
const iss = ATMOSPHERES.find((a) => a.id === "iss")!;
const lunar = ATMOSPHERES.find((a) => a.id === "lunar")!;
const check = (names: string[], atm: Atmosphere, flow: number) =>
  checkMaterials(names, (key) => atlasCell(bundle, engine, atm, key, flow));

test("parses one name per line, ignoring blanks and a BOM", () => {
  assert.deepEqual(parseMaterials("﻿Nomex\r\n\r\n  Kapton tape \n").names, ["Nomex", "Kapton tape"]);
});

test("reads the material column of a CSV and skips its header", () => {
  const csv = 'qty,Material,notes\n4,"Silicone seal, grey","not PMMA"\n2,Teflon tubing,x';
  assert.deepEqual(parseMaterials(csv).names, ["Silicone seal, grey", "Teflon tubing"]);
});

test("without a header, the first column is the material; a lone header word is skipped", () => {
  assert.deepEqual(parseMaterials("Nomex,2\nKapton,5").names, ["Nomex", "Kapton"]);
  assert.deepEqual(parseMaterials("Material\nNomex").names, ["Nomex"]);
});

test("caps the list and says so", () => {
  const r = parseMaterials(Array.from({ length: MAX_ROWS + 5 }, (_, i) => `m${i}`).join("\n"));
  assert.equal(r.names.length, MAX_ROWS);
  assert.equal(r.truncated, true);
});

test("matches whole words only, case-insensitively, through common names", () => {
  assert.deepEqual(matchMaterial("Clear ACRYLIC window").map((m) => m.key), ["pmma"]);
  assert.deepEqual(matchMaterial("PTFE-lined hose").map((m) => m.key), ["teflon"]);
  assert.deepEqual(matchMaterial("Cotton-fiberglass blend").map((m) => m.key), ["sibal"]);
  assert.deepEqual(matchMaterial("pmmaxyz"), []);
  assert.deepEqual(matchMaterial("Polyethylene foam"), []);
});

test("a name that matches several NASA materials is not guessed", () => {
  const rows = check(["Nomex and Kapton laminate"], iss, 20);
  assert.equal(rows[0].status, "ambiguous");
  assert.equal(rows[0].cell, null);
});

test("ISS cabin: tested materials are covered, untested solids only by a similar solid, unknowns stay unknown", () => {
  const rows = check(["Nomex fabric", "Kapton tape", "Neoprene gasket"], iss, 20);
  assert.deepEqual(rows.map((r) => r.status), ["covered", "similar", "unknown"]);
});

test("lunar atmosphere: nothing NASA recorded is covered, and the row says why", () => {
  const rows = check(["Silicone seal", "PMMA window", "Nomex fabric"], lunar, 20);
  assert.ok(rows.every((r) => r.status === "gap"));
  const si = rows[0].cell!;
  assert.equal(si.bcms, 72.7);
  assert.ok(si.dO2 !== null && Math.abs(si.dO2 - 7.9) < 0.05);
});

test("rows agree with the Atlas engine for the same material and atmosphere", () => {
  const [row] = check(["Teflon"], lunar, 20);
  assert.equal(row.cell!.bcms, 66.5);
});

test("summary counts every row once", () => {
  const rows = check(["Nomex", "Kapton", "Foam", "Nomex Kapton"], iss, 20);
  const s = summariseRows(rows);
  assert.equal(s.total, 4);
  assert.equal(s.covered + s.similar + s.gap + s.unknown + s.ambiguous, 4);
});

test("CSV keeps the user's wording, quotes commas and states the atmosphere", () => {
  const rows = check(["Silicone seal, grey", "Foam"], lunar, 5);
  const lines = checkCsv(rows, lunar, 5, (k) => k).trim().split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^"Silicone seal, grey",silicone,silicone,Conditions not covered,/);
  assert.match(lines[1], /,Lunar base \/ rover,30,70\.3,5$/);
  assert.match(lines[2], /^Foam,,,No NASA record,/);
});
