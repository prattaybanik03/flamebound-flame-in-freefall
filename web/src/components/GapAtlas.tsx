"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Evidence Gap Atlas: the headline finding, computed live from NASA's PSI corpus by the scoring engine.
import { useMemo, useState } from "react";
import type { Bundle, Target } from "@/lib/types";
import { hazard, rank } from "@/lib/bcms";
import { MATERIAL_OPTIONS } from "@/lib/presets";
import { searchFromTarget } from "@/lib/url";
import { ATLAS_FLOWS, ATLAS_MATERIALS, ATMOSPHERES, atlasCsv, computeAtlas, corpusFacts, summarise, type AtlasCell } from "@/lib/atlas";

const label = (k: string) => MATERIAL_OPTIONS.find((m) => m.key === k)?.label ?? k;
const fmt = (n: number) => String(Number(n.toFixed(1)));

function tone(c: AtlasCell) {
  if (c.covered) return "border-emerald-700 bg-emerald-950/50 text-emerald-200";
  if (c.bcms >= 65) return "border-amber-700 bg-amber-950/40 text-amber-200"; // fails only the O2 gate
  if (c.bcms >= 50) return "border-[#b4541c] bg-[#2a1608] text-[#ffc89a]"; // true orange: the orange-* utilities are re-tuned to flame blue
  return "border-red-800 bg-red-950/50 text-red-200";
}

export default function GapAtlas({ bundle, onOpen }: { bundle: Bundle; onOpen: (t: Target) => void }) {
  const [flow, setFlow] = useState(20);
  const cells = useMemo(() => computeAtlas(bundle, { rank, hazard: hazard as never }), [bundle]);
  const facts = useMemo(() => corpusFacts(bundle), [bundle]);
  const shown = cells.filter((c) => c.flowCmS === flow);
  const s = summarise(shown);
  const at = (m: string, a: string) => shown.find((c) => c.materialKey === m && c.atmosphere.id === a);

  const download = () => {
    const base = `${window.location.origin}${window.location.pathname}`;
    const csv = atlasCsv(cells, label, (t) => `${base}?${searchFromTarget(t)}`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "flamebound-evidence-gap-matrix.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <section id="atlas" aria-label="Evidence Gap Atlas" className="scroll-mt-16 rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-2xl text-slate-50">Evidence Gap Atlas: where NASA&apos;s microgravity fire data stops</h2>
          <p className="mt-2 text-base text-slate-200">
            Within the NASA PSI flammability records FlameBound ingested, today&apos;s ISS cabin air has a close test for{" "}
            <strong className="text-emerald-300">{s.issCovered} of {s.issTotal}</strong> common cabin materials ({s.issExact} on the
            exact material, the rest through a different solid). The lunar base, exploration and EVA atmospheres planned for
            Artemis have one for <strong className="text-red-300">{s.artemisCovered} of {s.artemisTotal}</strong> material and
            atmosphere combinations at this airflow. These are classifications under FlameBound&apos;s matching rules, not safety findings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Cabin airflow" className="flex gap-1">
            {ATLAS_FLOWS.map((f) => (
              <button key={f} type="button" aria-pressed={flow === f} onClick={() => setFlow(f)}
                className={`rounded-md px-2.5 py-1 text-xs ${flow === f ? "bg-orange-500 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>
                {f} cm/s airflow
              </button>
            ))}
          </div>
          <button type="button" onClick={download}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200">
            Download gap matrix (.csv)
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-separate border-spacing-1 text-left text-sm">
          <caption className="sr-only">Coverage score of the closest NASA flammability record for each atmosphere and material, at {flow} cm/s airflow and 0 g</caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1 text-xs font-normal text-slate-400">Material</th>
              {ATMOSPHERES.map((a) => (
                <th key={a.id} scope="col" className="px-2 py-1 font-normal">
                  <span className="font-display text-base text-slate-100">{a.label}</span>
                  <span className="block text-xs text-slate-400">{a.o2Pct}% O₂, {a.pressureKPa} kPa</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATLAS_MATERIALS.map((m) => (
              <tr key={m}>
                <th scope="row" className="px-2 py-1 text-sm font-normal text-slate-200">{label(m)}</th>
                {ATMOSPHERES.map((a) => {
                  const c = at(m, a.id);
                  if (!c) return <td key={a.id} />;
                  return (
                    <td key={a.id} className="p-0">
                      <button type="button" onClick={() => onOpen(c.target)}
                        title={`Closest NASA record: ${c.best.acronym} ${c.best.ref}, O₂ cell "${c.best.o2Raw}". Open this scenario.`}
                        className={`w-full rounded-md border px-2 py-1.5 text-left hover:brightness-125 ${tone(c)}`}>
                        <span className="font-display text-lg leading-none tabular-nums">{fmt(c.bcms)}%</span>{" "}
                        <span className="text-xs">{c.covered ? "covered" : "gap"}</span>
                        <span className="block text-xs opacity-90">
                          {c.dO2 === null ? "O₂ not recorded" : Math.abs(c.dO2) < 0.05 ? "O₂ matched" : `O₂ ${fmt(Math.abs(c.dO2))} ${Math.abs(c.dO2) === 1 ? "pt" : "pts"} ${c.dO2 > 0 ? "above" : "below"} NASA`}
                          {c.pressureRecorded ? "" : "; no pressure data"}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Each cell is the closest NASA flammability record&apos;s match score at 0 g. Covered: score of at least 65% and O₂
        within ±2 points. Gap colours: amber fails only the O₂ gate, orange scores 50–65%, red below 50%. Click any cell to open it.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-slate-950/50 p-3 text-sm text-slate-300">
          <h3 className="text-sm text-slate-100">Why the gap exists</h3>
          <p className="mt-1">
            PSI holds {facts.solidInvestigations.length} solid-material flammability investigations. The{" "}
            {facts.solidWithO2.length} whose tables record oxygen ({facts.solidWithO2.join(", ")}) all ran between{" "}
            {fmt(facts.solidMinO2)}% and {fmt(facts.solidMaxO2)}% O₂ ({facts.solidO2Values} recorded values), and none recorded
            cabin pressure. Only ACME BRE, a gas-fuelled burner that stands in for solids, reached{" "}
            {facts.surrogateMaxO2 ?? "higher"}% O₂.
          </p>
        </div>
        <div className="rounded-md bg-slate-950/50 p-3 text-sm text-slate-300">
          <h3 className="text-sm text-slate-100">Why ISS results do not carry over</h3>
          <p className="mt-1">
            The lunar base keeps about the same oxygen partial pressure as the ISS (about 21 kPa) but with less nitrogen.
            Nitrogen absorbs flame heat without burning, so a higher oxygen fraction makes flames hotter and materials more
            flammable. That is why FlameBound&apos;s oxygen gate uses concentration, not partial pressure.{" "}
            <span className="text-slate-400">(General combustion physics, not a PSI result.)</span>
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Scope: this is coverage of NASA&apos;s open PSI corpus as ingested here, not of every test NASA has run. For Kapton,
        Teflon, Pyrell and lampwick, &ldquo;covered&rdquo; means NASA tested a similar solid, not that exact material. Data
        coverage is not a fire-safety rating.
      </p>
    </section>
  );
}
