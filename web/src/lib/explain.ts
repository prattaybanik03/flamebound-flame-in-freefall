// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// SI-assisted: Codex added comparison regression fixes and numeric-token handling.
// Deterministic "why #1 beats #2" sentence, built only from the two rows' component scores
// and deltas. The optional LLM note (api/why) must pass the same numeric firewall.
import type { Component, Dim, Scored } from "./bcms";

export const DIM_LABEL: Record<Dim, string> = {
  o2: "O₂ match",
  material: "Material match",
  flow: "Airflow match",
  pressure: "Pressure match",
  pillar: "Pillar & scale",
};

const UNIT: Partial<Record<Dim, string>> = { o2: "% pts", flow: "cm/s", pressure: "kPa" };

export function fmt(n: number, d = 1) {
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}

function contrib(c: Component) {
  return c.score === null ? 0 : c.weight * c.score;
}

export function describe(c: Component): string {
  if (c.score === null) return `${DIM_LABEL[c.dim]}: not recorded`;
  const pct = Math.round(c.score * 100);
  const delta = c.delta !== null && UNIT[c.dim] ? ` (Δ${fmt(c.delta)} ${UNIT[c.dim]})` : "";
  return `${DIM_LABEL[c.dim]} ${pct}%${delta}`;
}

export function whyAbove(a: Scored, b: Scored): { text: string; numbers: string[] } {
  const nameA = `${a.investigation.acronym} ${a.record.ref}`;
  const nameB = `${b.investigation.acronym} ${b.record.ref}`;
  // This manifest comes only from deterministic code, never from generated prose.
  const note = (text: string) => ({ text, numbers: numericTokens(text) });
  if (a.bcms === b.bcms) {
    return note(`${nameA} and ${nameB} have the same displayed BCMS (${a.bcms}% vs ${b.bcms}%).`);
  }
  if (a.bcms < b.bcms) {
    return note(`${nameA} ranks below ${nameB} (${a.bcms}% vs ${b.bcms}%).`);
  }
  const diffs = a.components
    .map((ca) => {
      const cb = b.components.find((x) => x.dim === ca.dim)!;
      return { ca, cb, gain: contrib(ca) - contrib(cb) };
    })
    .filter((d) => d.gain > 0.0005)
    .sort((x, y) => y.gain - x.gain)
    .slice(0, 2);
  if (!diffs.length) {
    return note(`${nameA} has a higher displayed BCMS than ${nameB} (${a.bcms}% vs ${b.bcms}%).`);
  }
  const short = (c: Component) => {
    if (c.score === null) return "not recorded";
    const delta = c.delta !== null && UNIT[c.dim] ? ` (Δ${fmt(c.delta)} ${UNIT[c.dim]})` : "";
    return `${Math.round(c.score * 100)}%${delta}`;
  };
  const reasons = diffs.map(({ ca, cb }) => `${DIM_LABEL[ca.dim].toLowerCase()} ${short(ca)} vs ${short(cb)}`);
  const text = `${nameA} ranks above ${nameB} (${a.bcms}% vs ${b.bcms}%): ${reasons.join("; ")}.`;
  return note(text);
}

// Recognize complete numeric tokens so .5, 1,000 and 2e1 cannot be checked as
// unrelated integers. Preserve the Unicode minus used in scientific prose.
function numericTokens(text: string): string[] {
  return text.match(/[+\-−]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)(?:[eE][+\-−]?\d+)?/g) ?? [];
}

function canonicalNumber(token: string): string | null {
  const value = Number(token.replaceAll(",", "").replaceAll("−", "-"));
  return Number.isFinite(value) ? String(value) : null;
}

/**
 * Numeric firewall (S3): every number in `text` must appear in the allowed set
 * (numbers taken from the cited rows and computed scores). Returns offending numbers.
 * This is a value allowlist, not a check of units, attribution or scientific claims.
 */
export function numericFirewall(text: string, allowed: string[]): string[] {
  const ok = new Set(allowed.flatMap(numericTokens).map(canonicalNumber).filter((n) => n !== null));
  return numericTokens(text).filter((token) => {
    const value = canonicalNumber(token);
    return value === null || !ok.has(value);
  });
}
