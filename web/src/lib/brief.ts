// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// SI evidence briefing: the SI layer of FlameBound. Pure functions only (no network, no
// runtime imports), so every rule is unit-tested.
//
// Contract (decided by Pratt, Sat 14 Nov 14:20):
//   - Ranking and the hazard decision stay deterministic (bcms.ts). SI never reorders or rescores.
//   - The SI model sees ONLY an evidence pack built here from NASA records: the top
//     active-pillar matches, their verbatim cells and the hazard reasons.
//   - Its output is accepted only if every sentence cites evidence ([E1]...), every cited
//     id exists, every number appears in the evidence pack, and no safety verdict is claimed.
//     Otherwise the deterministic fallback brief is shown, labelled as such.
import type { Hazard, Scored } from "./bcms";
import type { Target } from "./types";

export interface EvidenceItem {
  id: string; // "E1"
  investigation: string;
  title: string;
  doi: string;
  doiUrl: string;
  portalUrl: string;
  record: string;
  table: string;
  dataRow: number; // 1-based, header excluded
  material: string;
  bcms: number;
  scoreCoveragePct: number;
  conditions: { name: string; nasaCell: string; column: string; status: string; differenceFromTarget: string }[];
  outcome: Record<string, string>;
  objective: string;
  researchImpacts: string;
}

export interface EvidencePack {
  target: {
    pillar: string;
    oxygenPct: number;
    pressureKPa: number;
    airflowCmS: number;
    flowDirection: string;
    material: string;
    gravityG: number;
  };
  hazard: string[];
  evidence: EvidenceItem[];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const UNIT: Record<string, string> = { o2: "% pts", flow: "cm/s", pressure: "kPa" };
const NAME: Record<string, string> = { o2: "oxygen", flow: "airflow", pressure: "pressure" };

/** Build the evidence pack: the only material the SI model may use. */
export function buildEvidence(
  ranked: Scored[], target: Target, hazard: Hazard | null, materialLabel: string, maxItems = 4,
): EvidencePack {
  const items = ranked.filter((s) => s.investigation.pillar === target.pillar).slice(0, maxItems);
  return {
    target: {
      pillar: target.pillar,
      oxygenPct: target.o2Pct,
      pressureKPa: Math.round(target.pressureKPa * 10) / 10,
      airflowCmS: target.flowCmS,
      flowDirection: target.flowDirection,
      material: materialLabel,
      gravityG: target.gravity,
    },
    hazard: hazard?.level === "hazard" ? hazard.reasons : [],
    evidence: items.map((s, i) => ({
      id: `E${i + 1}`,
      investigation: s.investigation.acronym,
      title: s.investigation.title,
      doi: s.investigation.doi,
      doiUrl: s.investigation.doiUrl,
      portalUrl: s.investigation.portalUrl,
      record: s.record.ref,
      table: s.record.table,
      dataRow: s.record.row + 1,
      material: s.record.material || "not recorded",
      bcms: s.bcms,
      scoreCoveragePct: Math.round(s.coverage * 100),
      conditions: s.components
        .filter((c) => c.dim === "o2" || c.dim === "flow" || c.dim === "pressure")
        .map((c) => ({
          name: NAME[c.dim],
          nasaCell: c.raw || "not recorded",
          column: c.col || "",
          status: c.status ?? "",
          differenceFromTarget:
            c.delta === null ? "not recorded by NASA" : `${Number(c.delta.toFixed(1))} ${UNIT[c.dim]}`,
        })),
      outcome: Object.fromEntries(Object.entries(s.record.outcome?.fields ?? {}).filter(([, v]) => v.trim() !== "")),
      objective: clip(s.investigation.objective || "", 400),
      researchImpacts: clip(s.investigation.impacts || "", 400),
    })),
  };
}

export const SYSTEM_PROMPT = [
  "You assist a spacecraft fire-safety engineer. You summarise and interpret NASA microgravity combustion evidence.",
  "Use ONLY the evidence pack in the user message. Do not use outside knowledge.",
  "Write 3 to 5 sentences of plain English prose: no headings, lists, bold or preamble.",
  "End EVERY sentence, including the first, with one or more citations in square brackets placed before the full stop, e.g. \"... [E1].\" or \"... [E1][E2].\" A sentence about the hazard cites the evidence item it concerns.",
  "In the prose, name records by investigation and record ID (e.g. \"SAFFIRE-II 2-7\"); use E-labels only inside the citation brackets.",
  "Only use numbers that appear in the evidence pack, copied exactly. Never compute, convert or round numbers.",
  "If the hazard list is not empty, your first sentence must say that NASA's data does not closely cover the engineer's conditions, and why.",
  "Describe what NASA tested and observed, how it differs from the engineer's target, and what is missing.",
  "Never say a material or cabin is safe or unsafe, never certify or approve anything, and never recommend a design decision.",
].join(" ");

export function buildUserMessage(pack: EvidencePack): string {
  return `Evidence pack (JSON):\n${JSON.stringify(pack)}\n\nWrite the briefing now.`;
}

/** Second-turn request after a rejected draft: names each problem so the model can fix exactly those. */
export function correctionMessage(problems: string[]): string {
  return `Your briefing failed automatic verification:\n- ${problems.join("\n- ")}\nRewrite it to fix every problem, following all the original rules. Reply with the briefing only.`;
}

export interface Sentence { text: string; cites: string[] }
export interface Validation { ok: boolean; sentences: Sentence[]; problems: string[] }

const CITE = /\[(E\d+)\]/g;
const VERDICT = /\b(is|are|would be|will be|remains?)\s+(safe|unsafe)\b|\bcertif|\bguarantee|\bapprov|\brecommend/i;

/** Split model text into sentences with their citations. */
export function splitSentences(text: string): Sentence[] {
  const clean = text.replace(/\s+/g, " ").trim();
  // A sentence ends at . ! or ? (plus any trailing citations) followed by whitespace and a capital letter,
  // quote, parenthesis or digit. Decimal points ("60.1%") and "e.g." are not followed by whitespace + capital.
  const parts = clean.split(/(?<=[.!?](?:\s*\[E\d+\])*)\s+(?=[A-Z0-9"'(])/);
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, cites: [...p.matchAll(CITE)].map((m) => m[1]) }));
}

/**
 * Validate an SI draft against the evidence pack.
 * `firewall(text, allowed)` returns numbers in `text` not present in `allowed` (explain.ts numericFirewall).
 */
export function validateBrief(
  text: string, pack: EvidencePack, firewall: (text: string, allowed: string[]) => string[],
): Validation {
  const problems: string[] = [];
  const sentences = splitSentences(text);
  const ids = new Set(pack.evidence.map((e) => e.id));
  if (sentences.length < 1 || sentences.length > 6) problems.push(`expected 1 to 6 sentences, got ${sentences.length}`);
  sentences.forEach((s, i) => {
    if (s.cites.length === 0) problems.push(`sentence ${i + 1} has no citation`);
    for (const c of s.cites) if (!ids.has(c)) problems.push(`sentence ${i + 1} cites unknown evidence ${c}`);
  });
  const withoutCites = text.replace(CITE, " ");
  const unsupported = firewall(withoutCites, [JSON.stringify(pack)]);
  if (unsupported.length) problems.push(`numbers not in NASA evidence: ${[...new Set(unsupported)].join(", ")}`);
  if (VERDICT.test(withoutCites)) problems.push("contains a safety verdict, certification or recommendation");
  if (pack.hazard.length && sentences[0] && !/\b(not|no|outside|beyond|lack|gap|differ)/i.test(sentences[0].text)) {
    problems.push("hazard is active but the first sentence does not state the coverage gap");
  }
  return { ok: problems.length === 0, sentences, problems };
}

/** Deterministic briefing used when SI is unavailable or its draft fails validation. */
export function fallbackBrief(pack: EvidencePack): Sentence[] {
  const out: Sentence[] = [];
  const [e1, e2] = pack.evidence;
  if (pack.hazard.length) {
    out.push({ text: `NASA's PSI data does not closely cover these conditions: ${pack.hazard[0]}`, cites: e1 ? [e1.id] : [] });
  }
  for (const e of [e1, e2].filter(Boolean) as EvidenceItem[]) {
    const cells = e.conditions
      .filter((c) => c.nasaCell !== "not recorded")
      .map((c) => `${c.name} "${c.nasaCell}"`)
      .join(", ");
    out.push({
      text: `${e.investigation} ${e.record} (${e.material}) scores ${e.bcms}% BCMS${cells ? `, with NASA recording ${cells}` : ""}.`,
      cites: [e.id],
    });
  }
  if (!e1) out.push({ text: `No ${pack.target.pillar} investigation in the PSI data is available to match.`, cites: [] });
  return out;
}
