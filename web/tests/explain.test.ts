// SI-assisted: explanation and numeric-firewall regression tests written with Codex.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rank } from "../src/lib/bcms.ts";
import { describe, numericFirewall, whyAbove } from "../src/lib/explain.ts";
import type { Bundle, Target } from "../src/lib/types.ts";

const bundle: Bundle = JSON.parse(readFileSync(new URL("../public/data/pyrovector.json", import.meta.url), "utf8"));
const target: Target = {
  o2Pct: 21, pressureKPa: 101.3, flowCmS: 20, flowDirection: "concurrent",
  materialKey: "sibal", thicknessMm: null, gravity: 0, pillar: "flammability",
};
const ranked = rank(bundle.records, bundle.investigations, target);

test("deterministic explanation supplies every number used in its own text", () => {
  const note = whyAbove(ranked[0], ranked[1]);
  assert.deepEqual(numericFirewall(note.text, note.numbers), []);
});

test("equal displayed BCMS is described as a tie despite different components", () => {
  const a = ranked[0];
  const b = { ...ranked[1], bcms: a.bcms };
  const note = whyAbove(a, b);
  assert.match(note.text, /same displayed BCMS|score equally/i);
  assert.doesNotMatch(note.text, /ranks above/i);
});

test("reversed comparison never claims the lower score ranks above or equally", () => {
  const note = whyAbove(ranked[1], ranked[0]);
  assert.match(note.text, /ranks below/i);
  assert.doesNotMatch(note.text, /ranks above|score equally/i);
});

test("component delta uses a readable delta symbol and explicit unit", () => {
  const component = ranked[0].components.find(c => c.dim === "o2")!;
  assert.match(describe(component), /Δ0\.5 % pts/);
});

test("missing component never becomes an exact numeric match", () => {
  const pressure = ranked[0].components.find(c => c.dim === "pressure")!;
  assert.equal(describe(pressure), "Pressure match: not recorded");
});

test("numeric firewall rejects an invented ordinary value", () => {
  assert.deepEqual(numericFirewall("Pressure 101.3 kPa, oxygen 34%", ["101.3", "21"]), ["34"]);
});

test("numeric firewall accepts equivalent decimal formatting", () => {
  assert.deepEqual(numericFirewall("21.00%", ["21"]), []);
});

test("numeric firewall reads scientific notation as one value", () => {
  assert.deepEqual(numericFirewall("2e1 cm/s", ["20"]), []);
  assert.deepEqual(numericFirewall("2e1 cm/s", ["2", "1"]), ["2e1"]);
});

test("numeric firewall reads leading decimals as fractional values", () => {
  assert.deepEqual(numericFirewall(".5 cm/s", ["0.5"]), []);
  assert.deepEqual(numericFirewall(".5 cm/s", ["5"]), [".5"]);
});

test("numeric firewall preserves a Unicode minus sign", () => {
  assert.deepEqual(numericFirewall("−5 kPa", ["5"]), ["−5"]);
  assert.deepEqual(numericFirewall("−5 kPa", ["-5"]), []);
});

test("numeric firewall treats thousands separators as part of a number", () => {
  assert.deepEqual(numericFirewall("1,000 kPa", ["1000"]), []);
  assert.deepEqual(numericFirewall("1,000 kPa", ["1", "0"]), ["1,000"]);
});

test("numeric firewall rejects non-finite numeric representations", () => {
  assert.deepEqual(numericFirewall("1e999 kPa", ["1e999"]), ["1e999"]);
});
