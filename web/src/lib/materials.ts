// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Materials checker: a user's list of cabin materials, checked against NASA's PSI flammability corpus for one
// atmosphere. It reuses the Evidence Gap Atlas engine, so a row here and a cell there always agree. Matching
// is deliberately conservative: a material NASA has no record of is reported as such, never guessed.
// Library files take their dependencies as arguments (and import types only) so the Node test runner can load them.
import type { Atmosphere, AtlasCell } from "./atlas.ts";

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Names that identify each NASA-tested material. Whole-word phrase matches on normalised text. */
export const SYNONYMS: { key: string; terms: string[] }[] = [
  { key: "sibal", terms: ["sibal", "cotton fiberglass", "cotton fibreglass"] },
  { key: "pmma", terms: ["pmma", "acrylic", "plexiglas", "plexiglass", "perspex", "lucite", "polymethyl methacrylate"] },
  { key: "nomex", terms: ["nomex", "meta aramid"] },
  { key: "silicone", terms: ["silicone", "pdms"] },
  { key: "kapton", terms: ["kapton", "polyimide"] },
  { key: "teflon", terms: ["teflon", "ptfe", "polytetrafluoroethylene"] },
  { key: "pyrell", terms: ["pyrell"] },
  { key: "lampwick", terms: ["lampwick", "lamp wick"] },
];

export const MAX_ROWS = 200;
const HEADER_NAMES = /^(material|materials|name|item|component|description|part)/i;

const normalise = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/** Split one CSV/TSV/semicolon line into fields, honouring double quotes. */
function fields(line: string): string[] {
  const out: string[] = []; let cur = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

/** One material per line, or a CSV whose header has a material/name/item column (otherwise the first column). */
export function parseMaterials(text: string): { names: string[]; truncated: boolean } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { names: [], truncated: false };
  const head = fields(lines[0]);
  const named = head.findIndex((h) => HEADER_NAMES.test(h));
  const isHeader = named >= 0 || (head.length === 1 && HEADER_NAMES.test(head[0]));
  const col = named >= 0 ? named : 0;
  const body = isHeader ? lines.slice(1) : lines;
  const names = body.map((l) => fields(l)[col] ?? "").filter(Boolean);
  return { names: names.slice(0, MAX_ROWS), truncated: names.length > MAX_ROWS };
}

/** Every NASA-tested material whose name appears in the text, with the word that matched. */
export function matchMaterial(name: string): { key: string; term: string }[] {
  const n = normalise(name);
  const hits: { key: string; term: string }[] = [];
  for (const s of SYNONYMS) {
    const term = s.terms.find((t) => n.includes(` ${t} `));
    if (term) hits.push({ key: s.key, term });
  }
  return hits;
}

export type RowStatus = "covered" | "similar" | "gap" | "unknown" | "ambiguous";
export interface CheckRow {
  input: string;
  status: RowStatus;
  /** NASA-tested material this row was matched to, and the word that matched it. */
  matched: { key: string; term: string } | null;
  cell: AtlasCell | null;
}

/**
 * covered: NASA tested this material and the closest record is within coverage.
 * similar: within coverage only through a different solid (no NASA record of this exact material).
 * gap: the closest record is outside coverage at this atmosphere (O2 or overall match).
 * unknown: no NASA-tested material by that name. ambiguous: names several, so none is assumed.
 */
export function checkMaterials(names: string[], cellFor: (materialKey: string) => AtlasCell | null): CheckRow[] {
  const cache = new Map<string, AtlasCell | null>();
  const cached = (key: string) => {
    if (!cache.has(key)) cache.set(key, cellFor(key));
    return cache.get(key) ?? null;
  };
  return names.map((input): CheckRow => {
    const hits = matchMaterial(input);
    if (hits.length === 0) return { input, status: "unknown", matched: null, cell: null };
    if (hits.length > 1) return { input, status: "ambiguous", matched: null, cell: null };
    const cell = cached(hits[0].key);
    if (!cell) return { input, status: "unknown", matched: null, cell: null };
    const status: RowStatus = !cell.covered ? "gap" : cell.exactMaterial ? "covered" : "similar";
    return { input, status, matched: hits[0], cell };
  });
}

export function summariseRows(rows: CheckRow[]): Record<RowStatus, number> & { total: number } {
  const out = { covered: 0, similar: 0, gap: 0, unknown: 0, ambiguous: 0, total: rows.length };
  for (const r of rows) out[r.status]++;
  return out;
}

export const STATUS_TEXT: Record<RowStatus, string> = {
  covered: "Covered",
  similar: "Similar solid only",
  gap: "Conditions not covered",
  unknown: "No NASA record",
  ambiguous: "Several materials named",
};

export function checkCsv(rows: CheckRow[], atmosphere: Atmosphere, flowCmS: number, materialLabel: (k: string) => string): string {
  const head = ["material_as_entered", "matched_nasa_material", "matched_on", "status", "coverage_bcms_pct", "nearest_nasa_record",
    "nearest_nasa_o2_cell", "o2_gap_pct_points", "pressure_recorded_by_nasa", "atmosphere", "o2_pct", "pressure_kpa", "airflow_cm_s"];
  const lines = rows.map((r) => [
    r.input, r.matched ? materialLabel(r.matched.key) : "", r.matched?.term ?? "", STATUS_TEXT[r.status],
    r.cell ? r.cell.bcms : "", r.cell ? `${r.cell.best.acronym} ${r.cell.best.ref}` : "", r.cell?.best.o2Raw ?? "",
    r.cell?.dO2 ?? "", r.cell ? (r.cell.pressureRecorded ? "yes" : "no") : "", atmosphere.label, atmosphere.o2Pct, atmosphere.pressureKPa, flowCmS,
  ]);
  return [head, ...lines].map((l) => l.map((v) => csvCell(v as string | number | null)).join(",")).join("\n") + "\n";
}
