// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Engineer's evidence report: one scenario, its hazard status, the closest NASA records with their
// verbatim cells, and formatted data citations. Pure functions (Markdown and printable HTML) so the
// content is unit-tested and identical in both formats. Contains only deterministic results: no SI text.
import type { Target } from "./types.ts";

export interface ReportComponent { dim: string; weight: number; score: number | null; basis: string }
export interface ReportMatch {
  rank: number;
  acronym: string;
  psi: string;
  title: string;
  ref: string;
  material: string;
  bcms: number;
  coverage: number;
  doi: string;
  portalUrl: string;
  table: string;
  /** 1-based data row in NASA's CSV, header excluded. */
  row: number;
  components: ReportComponent[];
  outcome: Record<string, string>;
}
export interface ReportInput {
  target: Target;
  materialLabel: string;
  scenarioUrl: string;
  dataBuiltOn: string;
  generatedAt: string;
  hazard: { level: "hazard" | "info"; reasons: string[] } | null;
  matches: ReportMatch[];
}

const DIM_LABEL: Record<string, string> = { o2: "O₂", material: "Material", flow: "Airflow", pressure: "Pressure", pillar: "Pillar & scale" };
const GRAVITY_LABEL: Record<number, string> = { 0: "0 g (microgravity)", 0.16: "0.16 g (Moon)", 0.38: "0.38 g (Mars)", 1: "1 g (Earth)" };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const psia = (kpa: number) => (kpa / 6.894757).toFixed(1);

function conditions(t: Target, materialLabel: string): [string, string][] {
  return [
    ["Pillar", t.pillar[0].toUpperCase() + t.pillar.slice(1)],
    ["Oxygen", `${t.o2Pct}% by volume`],
    ["Pressure", `${t.pressureKPa} kPa (${psia(t.pressureKPa)} psia)`],
    ["Airflow", `${t.flowCmS} cm/s, ${t.flowDirection}`],
    ["Material or fuel", materialLabel],
    ["Gravity", GRAVITY_LABEL[t.gravity] ?? `${t.gravity} g`],
  ];
}

function citations(matches: ReportMatch[]) {
  const seen = new Map<string, ReportMatch>();
  for (const m of matches) if (!seen.has(m.doi)) seen.set(m.doi, m);
  return [...seen.values()];
}

const status = (r: ReportInput) =>
  r.hazard?.level === "hazard"
    ? "EXTRAPOLATION HAZARD: NASA's data does not closely cover this scenario, so no conclusion is drawn."
    : "No hazard raised. This means NASA's data covers the scenario closely; it does not mean the cabin is safe.";

const DISCLAIMER =
  "BCMS (Boundary Condition Match Score) measures how closely NASA's recorded test conditions match this scenario. It is not a fire-safety rating, and this report is not a certification.";

export function reportMarkdown(r: ReportInput): string {
  const L: string[] = [];
  L.push(`# FlameBound evidence report`, "");
  L.push(`Generated ${r.generatedAt} from NASA PSI data built on ${r.dataBuiltOn}.`, "");
  L.push(`Scenario link: ${r.scenarioUrl}`, "");
  L.push(`## Scenario`, "", "| Condition | Value |", "| --- | --- |");
  for (const [k, v] of conditions(r.target, r.materialLabel)) L.push(`| ${k} | ${v} |`);
  L.push("", `## Coverage status`, "", `**${status(r)}**`, "");
  for (const reason of r.hazard?.reasons ?? []) L.push(`- ${reason}`);
  if (r.hazard?.reasons.length) L.push("");
  L.push(`## Closest NASA records (${r.target.pillar})`, "");
  for (const m of r.matches) {
    L.push(`### ${m.rank}. ${m.acronym} ${m.ref}: ${m.bcms}% BCMS`, "");
    L.push(`${m.title}. Material: ${m.material || "not stated"}. Evidence covers ${pct(m.coverage)} of the score weight.`, "");
    L.push("| Dimension | Weight | Match | NASA basis |", "| --- | --- | --- | --- |");
    for (const c of m.components) {
      L.push(`| ${DIM_LABEL[c.dim] ?? c.dim} | ${pct(c.weight)} | ${c.score === null ? "not recorded" : pct(c.score)} | ${c.basis.replace(/\|/g, "/")} |`);
    }
    const out = Object.entries(m.outcome);
    if (out.length) L.push("", `Recorded outcome: ${out.map(([k, v]) => `${k}: ${v}`).join("; ")}.`);
    L.push("", `Source: ${m.table}, data row ${m.row}. DOI https://doi.org/${m.doi}`, "");
  }
  L.push(`## Data citations`, "");
  for (const c of citations(r.matches)) {
    L.push(`- NASA Physical Sciences Informatics. ${c.title} (${c.acronym}, ${c.psi}) [Data set]. https://doi.org/${c.doi}`);
  }
  L.push("", "```bibtex");
  for (const c of citations(r.matches)) {
    const key = `psi_${c.psi.replace(/\W/g, "").toLowerCase()}`;
    L.push(`@misc{${key},`, `  title = {${c.title} (${c.acronym})},`, `  author = {{NASA Physical Sciences Informatics}},`, `  doi = {${c.doi}},`, `  url = {https://doi.org/${c.doi}},`, `  note = {${c.psi}, data set}`, `}`);
  }
  L.push("```", "", `---`, "", DISCLAIMER, "");
  return L.join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Self-contained, print-ready HTML (light theme for paper). */
export function reportHtml(r: ReportInput): string {
  const rows = conditions(r.target, r.materialLabel).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  const hazardCls = r.hazard?.level === "hazard" ? "hz" : "ok";
  const reasons = (r.hazard?.reasons ?? []).map((x) => `<li>${esc(x)}</li>`).join("");
  const matches = r.matches
    .map((m) => {
      const comps = m.components
        .map((c) => `<tr><td>${esc(DIM_LABEL[c.dim] ?? c.dim)}</td><td>${pct(c.weight)}</td><td>${c.score === null ? "not recorded" : pct(c.score)}</td><td>${esc(c.basis)}</td></tr>`)
        .join("");
      const out = Object.entries(m.outcome);
      return `<section class="m"><h3>${m.rank}. ${esc(m.acronym)} ${esc(m.ref)}: ${m.bcms}% BCMS</h3>
<p>${esc(m.title)}. Material: ${esc(m.material || "not stated")}. Evidence covers ${pct(m.coverage)} of the score weight.</p>
<table><thead><tr><th>Dimension</th><th>Weight</th><th>Match</th><th>NASA basis</th></tr></thead><tbody>${comps}</tbody></table>
${out.length ? `<p>Recorded outcome: ${esc(out.map(([k, v]) => `${k}: ${v}`).join("; "))}.</p>` : ""}
<p class="src">Source: ${esc(m.table)}, data row ${m.row}. <a href="https://doi.org/${esc(m.doi)}">DOI ${esc(m.doi)}</a></p></section>`;
    })
    .join("");
  const cites = citations(r.matches)
    .map((c) => `<li>NASA Physical Sciences Informatics. ${esc(c.title)} (${esc(c.acronym)}, ${esc(c.psi)}) [Data set]. <a href="https://doi.org/${esc(c.doi)}">https://doi.org/${esc(c.doi)}</a></li>`)
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>FlameBound evidence report</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#111827;max-width:52rem;margin:2rem auto;padding:0 1.25rem}
h1{font-size:1.6rem;margin:0 0 .25rem}h2{font-size:1.15rem;margin:1.6rem 0 .5rem;border-bottom:1px solid #d1d5db;padding-bottom:.2rem}
h3{font-size:1rem;margin:1.1rem 0 .3rem}table{border-collapse:collapse;width:100%;margin:.4rem 0}
th,td{border:1px solid #d1d5db;padding:.3rem .5rem;text-align:left;vertical-align:top}th{background:#f3f4f6;font-weight:600}
.meta{color:#4b5563;font-size:12px}.hz{border-left:4px solid #b91c1c;background:#fef2f2;padding:.5rem .75rem}
.ok{border-left:4px solid #1d4ed8;background:#eff6ff;padding:.5rem .75rem}.src{font-size:12px;color:#4b5563}
.m{break-inside:avoid}a{color:#1d4ed8}.disc{font-size:12px;color:#4b5563;border-top:1px solid #d1d5db;margin-top:1.5rem;padding-top:.5rem}
@media print{body{margin:0}a{color:#111827;text-decoration:none}}
</style></head><body>
<h1>FlameBound evidence report</h1>
<p class="meta">Generated ${esc(r.generatedAt)} from NASA PSI data built on ${esc(r.dataBuiltOn)}.<br>Scenario: <a href="${esc(r.scenarioUrl)}">${esc(r.scenarioUrl)}</a></p>
<h2>Scenario</h2><table><tbody>${rows}</tbody></table>
<h2>Coverage status</h2><div class="${hazardCls}"><strong>${esc(status(r))}</strong>${reasons ? `<ul>${reasons}</ul>` : ""}</div>
<h2>Closest NASA records (${esc(r.target.pillar)})</h2>${matches}
<h2>Data citations</h2><ul>${cites}</ul>
<p class="disc">${esc(DISCLAIMER)}</p>
</body></html>`;
}
