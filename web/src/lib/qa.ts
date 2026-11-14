// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// "Ask NASA's records": prompt, and the verification firewall for answers grounded in PSI passages.
// Pure functions; the numeric firewall is injected so tests need no extensionless imports.
import type { Passage } from "./retrieve.ts";

export const REFUSAL = "NASA's investigation records in this dataset do not answer that question.";

export const QA_SYSTEM_PROMPT = [
  "You answer questions from spacecraft fire-safety engineers using ONLY the NASA PSI investigation passages in the user message.",
  "Each passage has an ID such as P12, the investigation it comes from, and a DOI. Do not use outside knowledge.",
  "Write 2 to 4 sentences of plain English prose: no headings, lists, bold or preamble.",
  "End EVERY sentence with one or more passage citations in square brackets placed before the full stop, e.g. \"... [P12].\" or \"... [P3][P7].\"",
  "In the prose, name investigations (e.g. \"FLEX\", \"SAFFIRE-II\"); use passage IDs only inside the citation brackets.",
  "Only use numbers that appear in the passages you cite, copied exactly. If you quote NASA, copy the words exactly inside double quotes.",
  "If the passages only say what an investigation set out to study, answer by naming which investigations studied the question and what their records state, rather than refusing.",
  `Only if no passage is relevant to the question, reply with exactly this sentence and nothing else: ${REFUSAL}`,
  "Never say a material, design or cabin is safe or unsafe, and never certify, approve or recommend anything.",
].join(" ");

export function buildQaMessage(question: string, passages: Passage[]): string {
  // Investigations without an acronym are named by their title, e.g. "Computational ... SPICE Data Sets (PSI-60)".
  const name = (p: Passage) => (/^PSI-\d+$/.test(p.acronym) ? `${p.title} (${p.acronym})` : p.acronym);
  const pack = passages.map((p) => ({ id: p.id, investigation: name(p), field: p.field, doi: p.doi, text: p.text }));
  return `Question: ${question}\n\nNASA passages (JSON):\n${JSON.stringify(pack)}\n\nAnswer now.`;
}

export interface QaSentence { text: string; cites: string[] }
export interface QaValidation { ok: boolean; refusal: boolean; sentences: QaSentence[]; problems: string[] }

const CITE = /\[(P\d+)\]/g;
const VERDICT = /\b(is|are|would be|will be|remains?)\s+(safe|unsafe)\b|\bcertif|\bguarantee|\bapprov|\brecommend/i;
const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, "").replace(/[’‘]/g, "'").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
/** Words only: a quotation must use NASA's exact words in order; punctuation and case may differ. */
const words = (s: string) => ` ${s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim()} `;

export function splitQa(text: string): QaSentence[] {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean
    .split(/(?<=[.!?](?:\s*\[P\d+\])*)\s+(?=[A-Z0-9"'(“])/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ text: p, cites: [...p.matchAll(CITE)].map((m) => m[1]) }));
}

/** Quoted spans of 4+ words, which must appear verbatim in a cited passage. */
function quotes(sentence: string): string[] {
  return [...sentence.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1]).filter((q) => q.trim().split(/\s+/).length >= 4);
}

export function validateAnswer(
  text: string, passages: Passage[], firewall: (text: string, allowed: string[]) => string[],
): QaValidation {
  const trimmed = text.trim();
  if (norm(trimmed) === norm(REFUSAL)) return { ok: true, refusal: true, sentences: [{ text: REFUSAL, cites: [] }], problems: [] };
  const byId = new Map(passages.map((p) => [p.id, p]));
  // Longest first, so "FLEX-2" is removed before "FLEX".
  const names = [...new Set(passages.map((p) => p.acronym).filter((a) => /\d/.test(a)))].sort((a, b) => b.length - a.length);
  const sentences = splitQa(trimmed);
  const problems: string[] = [];
  if (sentences.length < 1 || sentences.length > 6) problems.push(`expected 1 to 6 sentences, got ${sentences.length}`);
  if (VERDICT.test(trimmed)) problems.push("contains a safety verdict, certification or recommendation");
  sentences.forEach((s, i) => {
    const n = i + 1;
    if (s.cites.length === 0) { problems.push(`sentence ${n} has no citation`); return; }
    const unknown = s.cites.filter((c) => !byId.has(c));
    if (unknown.length) { problems.push(`sentence ${n} cites ${unknown.join(", ")}, which was not provided`); return; }
    // A cited passage's own words plus its investigation's official title (also NASA's wording).
    const cited = s.cites.map((c) => { const p = byId.get(c)!; return `${p.title}. ${p.text}`; });
    const body = s.text.replace(CITE, "");
    for (const q of quotes(body)) {
      if (!cited.some((t) => words(t).includes(words(q)))) problems.push(`sentence ${n} quotes "${q.slice(0, 60)}", which is not verbatim in the cited passage`);
    }
    // Gravity labels ("0 g", "1 g") and investigation names ("FLEX-2", "PSI-117") contain digits but are
    // not measurements, so they are removed before the number check.
    const unnamed = names.reduce((t, n) => t.split(n).join(" "), body).replace(/\bPSI-\d+\b/g, " ");
    const bad = firewall(unnamed.replace(/\b[01]\s?-?\s?g\b/gi, ""), cited);
    if (bad.length) problems.push(`sentence ${n} uses ${bad.join(", ")}, not found in the cited passages`);
  });
  return { ok: problems.length === 0, refusal: false, sentences, problems };
}

export function qaCorrection(problems: string[]): string {
  return `Your answer failed automatic verification:\n- ${problems.join("\n- ")}\nRewrite it to fix every problem, following all the original rules. Reply with the answer only.`;
}
