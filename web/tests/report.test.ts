// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reportHtml, reportMarkdown, type ReportInput } from "../src/lib/report.ts";

const input: ReportInput = {
  target: { o2Pct: 30, pressureKPa: 70.3, flowCmS: 5, flowDirection: "concurrent", materialKey: "pmma", thicknessMm: null, gravity: 0, pillar: "flammability" },
  materialLabel: "PMMA (acrylic)",
  scenarioUrl: "https://example.test/?o2=30",
  dataBuiltOn: "2026-11-14",
  generatedAt: "2026-11-14 21:00",
  hazard: { level: "hazard", reasons: ["Best flammability match is 60.1% BCMS, below the 65% threshold."] },
  matches: [{
    rank: 1, acronym: "SAFFIRE-II", psi: "PSI-99", title: "Spacecraft Fire Experiment-II", ref: "2-7", material: "PMMA & Nomex",
    bcms: 60.1, coverage: 0.85, doi: "10.60555/2chp-m469", portalUrl: "", table: "PSI-99_Experimental table_SAFFIRE-2.csv", row: 7,
    components: [{ dim: "o2", weight: 0.3, score: 0.59, basis: 'NASA cell "~ 22.1"' }, { dim: "pressure", weight: 0.15, score: null, basis: "Not recorded in NASA's table" }],
    outcome: { "Burn time": "140 s" },
  }],
};

test("the report carries the scenario, hazard, NASA cells and a DOI citation", () => {
  const md = reportMarkdown(input);
  assert.match(md, /30% by volume/);
  assert.match(md, /10\.2 psia/);
  assert.match(md, /EXTRAPOLATION HAZARD/);
  assert.match(md, /NASA cell "~ 22\.1"/);
  assert.match(md, /\| Pressure \| 15% \| not recorded \|/);
  assert.match(md, /https:\/\/doi\.org\/10\.60555\/2chp-m469/);
  assert.match(md, /@misc\{psi_psi99,/);
  assert.match(md, /not a certification/);
});

test("printable HTML escapes NASA text and uses the same status wording", () => {
  const html = reportHtml({ ...input, matches: [{ ...input.matches[0], material: "<script>x</script>" }] });
  assert.ok(!html.includes("<script>x</script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /EXTRAPOLATION HAZARD/);
});

test("without a hazard the report says covered, not safe", () => {
  assert.match(reportMarkdown({ ...input, hazard: null }), /does not mean the cabin is safe/);
});
