// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Cited-verdicts-only rule (locked Sat 10:47): a 1 g vs microgravity verdict is shown
// only when a NASA source states it. Two sources qualify today:
//   1. SAFFIRE-II (PSI-99) table rows, which record 1 g and microgravity burn results side by side.
//   2. NASA's written research-impact statements on the investigation record (quoted verbatim).
// Otherwise the card says no direct comparison exists. No verdict is ever computed.

import type { Scored } from "./bcms";

export interface VerdictEvidence {
  kind: "table" | "statement";
  investigationId: string;
  acronym: string;
  doi: string;
  doiUrl: string;
  portalUrl: string;
  recordRef?: string;
  table?: string;
  row?: number;
  /** Values copied verbatim from NASA's table or text. */
  facts: { label: string; value: string }[];
  /** Plain reading, only when the table makes it unambiguous. */
  reading: string | null;
}

export interface Verdict {
  available: boolean;
  evidence: VerdictEvidence[];
  message: string;
}

const NONE = "No direct NASA 1 g vs microgravity comparison exists for these conditions in the PSI data.";

function isNil(v: string) {
  return /^~?\s*0$/.test(v.trim()) || /^n\/a/i.test(v.trim());
}

function saffire2Evidence(s: Scored): VerdictEvidence | null {
  const f = s.record.outcome?.fields;
  if (!f) return null;
  const ug = f["Microgravity burn length"] ?? "";
  const g1 = f["1-g burn length"] ?? "";
  if (!ug && !g1) return null;
  let reading: string | null = null;
  if (isNil(ug) && g1 && !isNil(g1)) {
    reading = "In this record the 1 g test burned while the microgravity sample did not: the 1 g result was the more severe of the two.";
  } else if (!isNil(ug) && isNil(g1)) {
    reading = "In this record the microgravity sample burned while the 1 g test did not: the 1 g result was the less severe of the two.";
  }
  const inv = s.investigation;
  return {
    kind: "table",
    investigationId: inv.id, acronym: inv.acronym, doi: inv.doi, doiUrl: inv.doiUrl, portalUrl: inv.portalUrl,
    recordRef: s.record.ref, table: s.record.table, row: s.record.row,
    facts: [
      { label: "Material", value: s.record.material },
      { label: "Thickness (NASA cell)", value: s.record.thickness.raw || "not recorded" },
      { label: "O₂ (NASA cell, %)", value: s.record.o2.raw || "not recorded" },
      { label: "Airflow (NASA cell)", value: s.record.flow.raw || "not recorded" },
      { label: "Flow direction", value: f["Flow direction"] ?? "" },
      { label: "Microgravity burn length", value: ug || "not recorded" },
      { label: "Microgravity spread", value: f["Microgravity spread"] || "not recorded" },
      { label: "1 g burn length", value: g1 || "not recorded" },
      { label: "1 g spread rate", value: f["1-g spread rate"] || "not recorded" },
    ],
    reading,
  };
}

/**
 * Collect cited verdict evidence for the target material from the ranked results.
 * `ranked` must already be scored against the engineer's target.
 */
export function buildVerdict(ranked: Scored[], allScored: Scored[], materialKey: string): Verdict {
  const evidence: VerdictEvidence[] = [];
  // 1. SAFFIRE-II rows for the same material (exact match only), best BCMS first.
  const saffire = allScored
    .filter((s) => s.record.inv === "PSI-99" && s.record.materialKeys.includes(materialKey))
    .sort((a, b) => b.bcms - a.bcms);
  for (const s of saffire.slice(0, 3)) {
    const e = saffire2Evidence(s);
    if (e) evidence.push(e);
  }
  // 2. Written NASA findings on the top-ranked investigations that explicitly compare
  //    behaviour with normal atmosphere / ventilation (quoted verbatim, never paraphrased).
  for (const s of ranked.slice(0, 5)) {
    const text = s.investigation.impacts || "";
    if (/(normal atmosphere|21% oxygen|without air flow|absence of air flow|normal gravity)/i.test(text)) {
      evidence.push({
        kind: "statement",
        investigationId: s.investigation.id, acronym: s.investigation.acronym, doi: s.investigation.doi,
        doiUrl: s.investigation.doiUrl, portalUrl: s.investigation.portalUrl,
        facts: [{ label: "NASA research impact statement", value: text }],
        reading: null,
      });
    }
  }
  return evidence.length
    ? { available: true, evidence, message: "Cited NASA evidence comparing 1 g and microgravity behaviour:" }
    : { available: false, evidence: [], message: NONE };
}
