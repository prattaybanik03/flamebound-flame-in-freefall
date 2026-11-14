// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINDINGS } from "../src/lib/findings.ts";

const invs: Record<string, unknown>[] = JSON.parse(readFileSync(new URL("../../data/investigations.json", import.meta.url), "utf8"));

test("every NASA quote appears verbatim in its PSI record, with the right DOI", () => {
  for (const f of FINDINGS) {
    const inv = invs.find((i) => i.acronym === f.acronym);
    assert.ok(inv, `${f.acronym} not in PSI data`);
    assert.equal(inv.id, f.psi);
    assert.equal(inv.doi, f.doi);
    assert.ok(String(inv[f.field]).includes(f.quote), `${f.id}: quote not verbatim in ${f.acronym}.${f.field}`);
  }
});

test("both scored pillars have NASA context", () => {
  assert.ok(FINDINGS.some((f) => f.pillar === "flammability"));
  assert.ok(FINDINGS.some((f) => f.pillar === "suppression"));
});
