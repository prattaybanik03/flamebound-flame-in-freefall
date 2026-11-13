// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
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
  const diffs = a.components
    .map((ca) => {
      const cb = b.components.find((x) => x.dim === ca.dim)!;
      return { ca, cb, gain: contrib(ca) - contrib(cb) };
    })
    .filter((d) => d.gain > 0.0005)
    .sort((x, y) => y.gain - x.gain)
    .slice(0, 2);
  const nameA = `${a.investigation.acronym} ${a.record.ref}`;
  const nameB = `${b.investigation.acronym} ${b.record.ref}`;
  if (!diffs.length) {
    return { text: `${nameA} and ${nameB} score equally (${a.bcms}% vs ${b.bcms}%).`, numbers: [String(a.bcms), String(b.bcms)] };
  }
  const short = (c: Component) => {
    if (c.score === null) return "not recorded";
    const delta = c.delta !== null && UNIT[c.dim] ? ` (Δ${fmt(c.delta)} ${UNIT[c.dim]})` : "";
    return `${Math.round(c.score * 100)}%${delta}`;
  };
  const reasons = diffs.map(({ ca, cb }) => `${DIM_LABEL[ca.dim].toLowerCase()} ${short(ca)} vs ${short(cb)}`);
  const text = `${nameA} ranks above ${nameB} (${a.bcms}% vs ${b.bcms}%): ${reasons.join("; ")}.`;
  return { text, numbers: [String(a.bcms), String(b.bcms)] };
}

/**
 * Numeric firewall (S3): every number in `text` must appear in the allowed set
 * (numbers taken from the cited rows and computed scores). Returns offending numbers.
 */
export function numericFirewall(text: string, allowed: string[]): string[] {
  const norm = (s: string) => String(Number(s));
  const ok = new Set(allowed.flatMap((a) => (a.match(/-?\d+(?:\.\d+)?/g) ?? []).map(norm)));
  const found = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return found.filter((n) => !ok.has(norm(n)));
}
