"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Evidence report export: the tangible output an engineer takes to a design review.
// Markdown download, or a print-ready page (Save as PDF from the print dialog).
import type { Scored, Hazard } from "@/lib/bcms";
import type { Target } from "@/lib/types";
import { MATERIAL_OPTIONS } from "@/lib/presets";
import { reportHtml, reportMarkdown, type ReportInput } from "@/lib/report";
import { basisText } from "./ResultCard";

interface Props { target: Target; ranked: Scored[]; hazard: Hazard | null; builtOn: string }

function buildInput({ target, ranked, hazard, builtOn }: Props): ReportInput {
  const condOf = (s: Scored, dim: string) =>
    dim === "o2" ? s.record.o2 : dim === "flow" ? s.record.flow : dim === "pressure" ? s.record.pressure : undefined;
  const matches = ranked
    .filter((s) => s.investigation.pillar === target.pillar)
    .slice(0, 5)
    .map((s, i) => ({
      rank: i + 1,
      acronym: s.investigation.acronym,
      psi: s.investigation.id,
      title: s.investigation.title,
      ref: s.record.ref,
      material: s.record.material,
      bcms: s.bcms,
      coverage: s.coverage,
      doi: s.investigation.doi,
      portalUrl: s.investigation.portalUrl,
      table: s.record.table,
      row: s.record.row + 1, // 1-based, header excluded, as on the evidence cards
      components: s.components.map((c) => ({ dim: c.dim, weight: c.weight, score: c.score, basis: basisText(c, condOf(s, c.dim)) })),
      outcome: Object.fromEntries(Object.entries(s.record.outcome?.fields ?? {}).filter(([, v]) => v.trim() !== "")),
    }));
  return {
    target,
    materialLabel: MATERIAL_OPTIONS.find((m) => m.key === target.materialKey)?.label ?? target.materialKey,
    scenarioUrl: window.location.href,
    dataBuiltOn: builtOn,
    generatedAt: new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }),
    hazard,
    matches,
  };
}

export default function ReportButtons(props: Props) {
  const download = () => {
    const blob = new Blob([reportMarkdown(buildInput(props))], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flamebound-report-${props.target.pillar}-${props.target.o2Pct}pct-${props.target.materialKey}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(reportHtml(buildInput(props)));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  const btn = "rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200";
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={print} className={btn}>Print evidence report</button>
      <button type="button" onClick={download} className={btn}>Download report (.md)</button>
    </div>
  );
}
