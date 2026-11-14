// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndex, retrieve, stem, tokenize, type Passage } from "../src/lib/retrieve.ts";
import { EVAL_QUESTIONS } from "../src/lib/askEval.ts";

const passages: Passage[] = JSON.parse(readFileSync(new URL("../public/data/passages.json", import.meta.url), "utf8"));
const index = buildIndex(passages);

test("tokenizer drops stop words and stems plurals and -ing", () => {
  assert.deepEqual(tokenize("What are the suppressants being tested?"), ["suppressant"]);
  assert.equal(stem("flames"), "flame");
  assert.equal(stem("flame"), "flame");
  assert.equal(stem("gases"), "gas");
  assert.equal(stem("pass"), "pass");
  assert.equal(stem("burning"), "burn");
});

test("every passage is traceable to an investigation and DOI", () => {
  assert.ok(passages.length > 100);
  for (const p of passages) {
    assert.match(p.id, /^P\d+$/);
    assert.match(p.doi, /^10\.60555\//);
    assert.ok(p.text.length > 0 && p.text.length <= 1500);
  }
});

test("retrieval hit@5 on the labelled questions", () => {
  const misses: string[] = [];
  for (const { q, expect } of EVAL_QUESTIONS) {
    const top = retrieve(index, q, 5).map((h) => h.passage.acronym);
    if (!top.some((a) => expect.includes(a))) misses.push(`${q} -> ${top.join(", ")}`);
  }
  assert.deepEqual(misses, []);
});

test("an off-topic question matches far more weakly than an on-topic one", () => {
  const off = retrieve(index, "Who won the football grand final?", 1)[0]?.score ?? 0;
  const on = retrieve(index, "Which fire suppressants did NASA test in microgravity?", 1)[0].score;
  assert.ok(off < on / 1.5, `off-topic ${off} vs on-topic ${on}`);
});
