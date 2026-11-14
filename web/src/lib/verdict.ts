// SI-assisted: drafted with Claude (Anthropic); reviewed by the team. Hardened Sat 14 Nov
// after an independent review by Codex (OpenAI).
//
// Cited-verdicts-only rule (locked Sat 10:47). A 1 g vs microgravity comparison is shown
// only from a NASA source that actually records both: today that is SAFFIRE-II (PSI-99),
// whose table lists 1 g and microgravity burn results side by side. Nothing is computed.
//
// Guardrails:
//  - Observations are tied to the NASA record's OWN conditions, with the differences from
//    the engineer's target shown. A reading is about that record, never about "your cabin".
//  - When the Extrapolation Hazard (P5) is active, the card is gated: evidence is shown as
//    nearest NASA observations only, with no target-specific conclusion.
//  - "n/a" / blank / not recorded are UNKNOWN, never evidence of "did not burn".
//  - Written NASA findings that are not gravity comparisons (e.g. ACME BRE on raised O2 and
//    still air) are listed as related context and never make a verdict "available".

import type { Scored } from "./bcms";
import type { Condition, Status } from "./types";

/** A condition cell as a fact, keeping its audited status. */
function cellFact(label: string, c: Condition): { label: string; value: string; status: Status } {
  return { label, value: c.raw || "not recorded", status: c.status };
}

export interface VerdictEvidence {
  kind: "table";
  investigationId: string;
  acronym: string;
  doi: string;
  doiUrl: string;
  portalUrl: string;
  recordRef: string;
  table: string;
  row: number;
  /**
   * Values copied verbatim from NASA's table. `status` is carried for condition cells so a
   * `suspect` (withheld) or `unparsed` value is never presented as a usable NASA value.
   */
  facts: { label: string; value: string; status?: Status }[];
  /** Differences between this NASA record and the engineer's target (canonical units). */
  targetDeltas: { label: string; value: string }[];
  /** Plain reading of THIS record only, when the table makes it unambiguous. */
  reading: string | null;
}

export interface RelatedFinding {
  investigationId: string;
  acronym: string;
  doi: string;
  doiUrl: string;
  portalUrl: string;
  /** NASA's research-impact statement, verbatim. */
  text: string;
}

export interface Verdict {
  /** True only when table evidence recording both 1 g and microgravity results exists. */
  available: boolean;
  /** True when the Extrapolation Hazard is active: no target-specific conclusion. */
  gated: boolean;
  evidence: VerdictEvidence[];
  related: RelatedFinding[];
  message: string;
}

export const NO_COMPARISON =
  "No direct 1 g vs microgravity comparison found in the retrieved PSI evidence for this material.";
export const GATED_MESSAGE =
  "Extrapolation Hazard active: these are the nearest NASA observations at NASA's own test conditions, not a conclusion about your cabin.";

/** Exactly zero burn ("0", "~ 0"). Anything with qualifiers or notes is not treated as zero. */
function isZero(v: string): boolean {
  return /^~?\s*0(\.0+)?\s*(cm|mm)?$/i.test(v.trim());
}

/** Unknown: blank, n/a, not recorded, or a pointer to a note/figure. */
function isUnknown(v: string): boolean {
  const s = v.trim();
  return s === "" || /^n\/?a\b/i.test(s) || /not recorded/i.test(s) || /^(see|note)\b/i.test(s);
}

/** A positive burn observation: "Complete", or a length greater than zero with no qualifier note. */
function isBurn(v: string): boolean {
  const s = v.trim();
  if (/^complete$/i.test(s)) return true;
  const m = s.match(/^~?\s*(\d*\.?\d+)\s*(cm|mm)$/i);
  return !!m && Number(m[1]) > 0;
}

function saffire2Evidence(s: Scored): VerdictEvidence | null {
  const f = s.record.outcome?.fields;
  if (!f) return null;
  const ug = f["Microgravity burn length"] ?? "";
  const g1 = f["1-g burn length"] ?? "";
  if (isUnknown(ug) && isUnknown(g1)) return null;

  let reading: string | null = null;
  if (!isUnknown(ug) && !isUnknown(g1)) {
    if (isZero(ug) && isBurn(g1)) {
      reading = "In this NASA record, the 1 g test burned while the microgravity sample did not: at these test conditions the 1 g result was the more severe.";
    } else if (isBurn(ug) && isZero(g1)) {
      reading = "In this NASA record, the microgravity sample burned while the 1 g test did not: at these test conditions the 1 g result was the less severe.";
    }
  }

  const deltas: { label: string; value: string }[] = [];
  for (const c of s.components) {
    if (c.dim !== "o2" && c.dim !== "flow" && c.dim !== "pressure") continue;
    const label = c.dim === "o2" ? "O₂ difference from your target" : c.dim === "flow" ? "Airflow difference" : "Pressure difference";
    const unit = c.dim === "o2" ? "% pts" : c.dim === "flow" ? "cm/s" : "kPa";
    deltas.push({ label, value: c.delta === null ? "not recorded by NASA" : `Δ${Number.isInteger(c.delta) ? c.delta : c.delta.toFixed(1)} ${unit}` });
  }

  const inv = s.investigation;
  return {
    kind: "table",
    investigationId: inv.id, acronym: inv.acronym, doi: inv.doi, doiUrl: inv.doiUrl, portalUrl: inv.portalUrl,
    recordRef: s.record.ref, table: s.record.table, row: s.record.row,
    facts: [
      { label: "Material", value: s.record.material },
      cellFact("Thickness (NASA cell)", s.record.thickness),
      cellFact("O₂ (NASA cell, %)", s.record.o2),
      cellFact("Airflow (NASA cell)", s.record.flow),
      { label: "Flow direction", value: f["Flow direction"] || "not recorded" },
      { label: "Microgravity burn length", value: ug || "not recorded" },
      { label: "Microgravity spread", value: f["Microgravity spread"] || "not recorded" },
      { label: "1 g burn length", value: g1 || "not recorded" },
      { label: "1 g spread rate", value: f["1-g spread rate"] || "not recorded" },
    ],
    targetDeltas: deltas,
    reading,
  };
}

const GRAVITY_COMPARISON_SOURCES = new Set(["PSI-99"]); // SAFFIRE-II records 1 g and microgravity side by side

/**
 * Collect cited 1 g vs microgravity evidence for the target material.
 * @param ranked     results of rank() for the target (used for related findings)
 * @param allScored  every record scored against the target
 * @param hazardLevel pass hazard(ranked, target)?.level, so the card can be gated (P5)
 */
export function buildVerdict(
  ranked: Scored[], allScored: Scored[], materialKey: string, hazardLevel: "hazard" | "info" | null = null,
): Verdict {
  const evidence = allScored
    .filter((s) => GRAVITY_COMPARISON_SOURCES.has(s.record.inv) && s.record.materialKeys.includes(materialKey))
    .sort((a, b) => b.bcms - a.bcms)
    .map(saffire2Evidence)
    .filter((e): e is VerdictEvidence => e !== null)
    .slice(0, 4);

  const related: RelatedFinding[] = ranked
    .slice(0, 5)
    .filter((s) => !GRAVITY_COMPARISON_SOURCES.has(s.investigation.id) && s.investigation.impacts)
    .filter((s) => /(normal atmosphere|21% oxygen|without air flow|absence of air flow|normal gravity)/i.test(s.investigation.impacts))
    .map((s) => ({
      investigationId: s.investigation.id, acronym: s.investigation.acronym, doi: s.investigation.doi,
      doiUrl: s.investigation.doiUrl, portalUrl: s.investigation.portalUrl, text: s.investigation.impacts,
    }));

  const gated = hazardLevel === "hazard";
  const available = evidence.length > 0;
  return {
    available,
    gated,
    evidence,
    related,
    message: !available ? NO_COMPARISON : gated ? GATED_MESSAGE
      : "Cited NASA records that tested this material in both 1 g and microgravity (readings apply to NASA's test conditions shown):",
  };
}
