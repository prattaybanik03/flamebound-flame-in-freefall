// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { numericFirewall } from "../src/lib/explain.ts";
import { REFUSAL, splitQa, validateAnswer } from "../src/lib/qa.ts";
import type { Passage } from "../src/lib/retrieve.ts";

const P: Passage[] = [
  { id: "P7", psi: "PSI-69", acronym: "FLEX", title: "Flame Extinguishment Experiment", doi: "10.60555/mbq8-0451", field: "objective",
    text: "The FLEX investigation aims to map the flammability limits of liquid fuels in microgravity environments, measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6." },
  { id: "P9", psi: "PSI-25", acronym: "BASS-II", title: "Burning and Suppression of Solids II", doi: "10.60555/4qc4-de67", field: "hypothesis",
    text: "However, it may not be conservative for flammability in space. Testing at 21 and 40 percent oxygen." },
];
const v = (t: string) => validateAnswer(t, P, numericFirewall);

test("a cited, verbatim, number-grounded answer passes", () => {
  const r = v('FLEX measured gaseous suppressants such as CO2, He, and SF6 [P7]. BASS-II notes the 1 g test "may not be conservative for flammability in space" [P9].');
  assert.deepEqual(r.problems, []);
  assert.equal(r.sentences.length, 2);
});

test("the exact refusal is accepted without citations", () => {
  const r = v(REFUSAL);
  assert.ok(r.ok && r.refusal);
});

test("uncited sentences, unknown passages, invented numbers and altered quotes are rejected", () => {
  const r = v('FLEX tested suppressants. It ran 99 tests [P7]. BASS-II says it "is never conservative for flammability in space" [P9]. Also [P42] says so [P42].');
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes("sentence 1 has no citation")));
  assert.ok(r.problems.some((p) => p.includes("99")));
  assert.ok(r.problems.some((p) => p.includes("not verbatim")));
  assert.ok(r.problems.some((p) => p.includes("P42")));
});

test("gravity labels are not numbers, but other numbers still are", () => {
  assert.ok(v("FLEX compared 0 g and 1-g behaviour [P7].").ok);
  assert.equal(v("FLEX ran at 3 g [P7].").ok, false);
});

test("investigation names with digits are not treated as numbers", () => {
  const withFlex2 = [...P, { ...P[0], id: "P11", acronym: "FLEX-2", text: "FLEX-2 studied droplet arrays." }];
  assert.ok(validateAnswer("FLEX-2 studied droplet arrays [P11].", withFlex2, numericFirewall).ok);
  assert.ok(validateAnswer("PSI-117 is cited here [P7].", P, numericFirewall).ok);
});

test("quotes match on NASA's exact words, ignoring punctuation, but not on changed words", () => {
  assert.ok(v('BASS-II says the test "may not be conservative for flammability in space," [P9].').ok);
  assert.equal(v('BASS-II says the test "may never be conservative for flammability in space" [P9].').ok, false);
});

test("quoting the cited investigation's official title is allowed", () => {
  assert.ok(v('FLEX, the "Flame Extinguishment Experiment", measured suppressants [P7].').ok);
});

test("safety verdicts are rejected", () => {
  assert.equal(v("This material is safe in space [P9].").ok, false);
});

test("decimals and trailing citations do not split sentences", () => {
  assert.equal(splitQa("SF6 at 0.5 atm was tested [P7]. Next one [P9].").length, 2);
});
