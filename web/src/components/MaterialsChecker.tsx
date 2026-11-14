"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Materials checker: paste or upload a list of cabin materials, pick an atmosphere, see which are backed by
// NASA's microgravity fire records. Runs entirely in the browser: the list is never uploaded or sent to an AI.
import { useMemo, useState } from "react";
import type { Bundle, Target } from "@/lib/types";
import { hazard, rank } from "@/lib/bcms";
import { MATERIAL_OPTIONS } from "@/lib/presets";
import { ATLAS_FLOWS, ATMOSPHERES, atlasCell, type Atmosphere } from "@/lib/atlas";
import { STATUS_TEXT, checkCsv, checkMaterials, parseMaterials, summariseRows, type RowStatus } from "@/lib/materials";

const label = (k: string) => MATERIAL_OPTIONS.find((m) => m.key === k)?.label ?? k;
const fmt = (n: number) => String(Number(n.toFixed(1)));
const SAMPLE = "Kapton tape\nPMMA (acrylic) window\nNomex fabric\nSilicone seal\nTeflon tubing\nCotton-fiberglass blend (SIBAL)\nPolyethylene foam\nNeoprene gasket\nNylon hook-and-loop fastener";
const INPUT = "rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100";

// Status is always written out in words; colour only reinforces it.
const TONE: Record<RowStatus, string> = {
  covered: "border-emerald-700 bg-emerald-950/50 text-emerald-200",
  similar: "border-amber-700 bg-amber-950/40 text-amber-200",
  gap: "border-[#b4541c] bg-[#2a1608] text-[#ffc89a]", // true orange: the orange-* utilities are re-tuned to flame blue
  unknown: "border-red-800 bg-red-950/50 text-red-200",
  ambiguous: "border-slate-600 bg-slate-800/60 text-slate-200",
};

export default function MaterialsChecker({ bundle, onOpen }: { bundle: Bundle; onOpen: (t: Target) => void }) {
  const [text, setText] = useState("");
  const [atmId, setAtmId] = useState("lunar");
  const [custom, setCustom] = useState({ o2: "30", kpa: "70.3" });
  const [flow, setFlow] = useState(20);
  const [run, setRun] = useState<{ text: string; atm: Atmosphere; flow: number } | null>(null);
  const [fileNote, setFileNote] = useState("");

  const atmosphere = (): Atmosphere => {
    if (atmId !== "custom") return ATMOSPHERES.find((a) => a.id === atmId) ?? ATMOSPHERES[1];
    const o2 = Math.min(100, Math.max(0, Number(custom.o2) || 0));
    const kpa = Math.min(200, Math.max(1, Number(custom.kpa) || 1));
    return { id: "custom", label: "Custom atmosphere", o2Pct: o2, pressureKPa: kpa, artemis: true };
  };

  const parsed = useMemo(() => (run ? parseMaterials(run.text) : null), [run]);
  const rows = useMemo(
    () => (run && parsed
      ? checkMaterials(parsed.names, (key) => atlasCell(bundle, { rank, hazard: hazard as never }, run.atm, key, run.flow))
      : []),
    [bundle, run, parsed],
  );
  const s = summariseRows(rows);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_000_000) { setFileNote("That file is over 1 MB. Paste the material names instead."); return; }
    setText(await f.text());
    setFileNote(`Loaded ${f.name}. It stays in your browser.`);
  };

  const download = () => {
    if (!run) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([checkCsv(rows, run.atm, run.flow, label)], { type: "text/csv;charset=utf-8" }));
    a.download = "flamebound-materials-coverage.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <section id="materials" aria-label="Materials checker" className="scroll-mt-6 rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-2xl text-slate-50">Materials checker: which of your materials does NASA&apos;s fire data cover?</h2>
      <p className="mt-2 max-w-3xl text-base text-slate-200">
        Paste a list of cabin materials, one per line, or load a CSV with a &ldquo;material&rdquo; column. FlameBound checks each against
        NASA&apos;s microgravity flammability records for the atmosphere you choose. The list stays in your browser: nothing is uploaded or sent to an AI.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_20rem]">
        <div>
          <label htmlFor="mc-list" className="text-sm text-slate-300">Materials list</label>
          <textarea id="mc-list" value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false}
            placeholder={"Kapton tape\nPMMA window\nSilicone seal"} className={`${INPUT} mt-1 w-full font-mono`} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setText(SAMPLE); setFileNote("Sample list (illustrative, not a real bill of materials)."); }}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200">Try a sample list</button>
            <label className="cursor-pointer rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200">
              Load a CSV or text file
              <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <span role="status" className="text-xs text-slate-400">{fileNote}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="mc-atm" className="text-sm text-slate-300">Atmosphere</label>
            <select id="mc-atm" value={atmId} onChange={(e) => setAtmId(e.target.value)} className={`${INPUT} mt-1 w-full`}>
              {ATMOSPHERES.map((a) => <option key={a.id} value={a.id}>{a.label} ({a.o2Pct}% O₂, {a.pressureKPa} kPa)</option>)}
              <option value="custom">Custom…</option>
            </select>
          </div>
          {atmId === "custom" && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor="mc-o2" className="text-xs text-slate-300">O₂ (%)</label>
                <input id="mc-o2" inputMode="decimal" value={custom.o2} onChange={(e) => setCustom({ ...custom, o2: e.target.value })} className={`${INPUT} mt-1 w-full`} />
              </div>
              <div className="flex-1">
                <label htmlFor="mc-kpa" className="text-xs text-slate-300">Pressure (kPa)</label>
                <input id="mc-kpa" inputMode="decimal" value={custom.kpa} onChange={(e) => setCustom({ ...custom, kpa: e.target.value })} className={`${INPUT} mt-1 w-full`} />
              </div>
            </div>
          )}
          <div role="group" aria-label="Cabin airflow" className="flex gap-1">
            {ATLAS_FLOWS.map((f) => (
              <button key={f} type="button" aria-pressed={flow === f} onClick={() => setFlow(f)}
                className={`rounded-md px-2.5 py-1 text-xs ${flow === f ? "bg-orange-500 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>
                {f} cm/s airflow
              </button>
            ))}
          </div>
          <button type="button" disabled={!text.trim()} onClick={() => setRun({ text, atm: atmosphere(), flow })}
            className="rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
            Check materials
          </button>
        </div>
      </div>

      {run && (
        <div className="mt-5" aria-live="polite">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-300">No material names found. Put one name per line, or use a CSV with a &ldquo;material&rdquo; column.</p>
          ) : (
            <>
              <p className="text-base text-slate-200">
                {s.total} {s.total === 1 ? "material" : "materials"} checked for <strong>{run.atm.label}</strong> ({fmt(run.atm.o2Pct)}% O₂, {fmt(run.atm.pressureKPa)} kPa, {run.flow} cm/s):{" "}
                <strong className="text-emerald-300">{s.covered} covered</strong>,{" "}
                <strong className="text-amber-300">{s.similar} similar solid only</strong>,{" "}
                <strong className="text-[#ffc89a]">{s.gap} conditions not covered</strong>,{" "}
                <strong className="text-red-300">{s.unknown + s.ambiguous} with no usable NASA record</strong>.
              </p>
              {parsed?.truncated && <p className="mt-1 text-sm text-amber-300">Only the first 200 lines were checked.</p>}
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-left text-sm">
                  <caption className="sr-only">Coverage of each listed material by NASA microgravity flammability records</caption>
                  <thead>
                    <tr className="text-xs text-slate-400">
                      <th scope="col" className="px-2 py-1 font-normal">Your material</th>
                      <th scope="col" className="px-2 py-1 font-normal">Matched to</th>
                      <th scope="col" className="px-2 py-1 font-normal">Coverage</th>
                      <th scope="col" className="px-2 py-1 font-normal">Closest NASA record</th>
                      <th scope="col" className="px-2 py-1 font-normal"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.input}-${i}`} className="align-top">
                        <th scope="row" className="px-2 py-1.5 font-normal text-slate-100">{r.input}</th>
                        <td className="px-2 py-1.5 text-slate-300">
                          {r.matched ? <>{label(r.matched.key)}<span className="block text-xs text-slate-400">matched on &ldquo;{r.matched.term}&rdquo;</span></> : "No NASA-tested material by this name"}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-block rounded-md border px-2 py-0.5 text-xs ${TONE[r.status]}`}>{STATUS_TEXT[r.status]}</span>
                          {r.cell && <span className="ml-2 tabular-nums text-slate-200">{fmt(r.cell.bcms)}%</span>}
                        </td>
                        <td className="px-2 py-1.5 text-slate-300">
                          {r.cell ? (
                            <>
                              {r.cell.best.acronym} {r.cell.best.ref}
                              <span className="block text-xs text-slate-400">
                                {r.cell.dO2 === null ? "O₂ not recorded" : Math.abs(r.cell.dO2) < 0.05 ? "O₂ matched" : `O₂ ${fmt(Math.abs(r.cell.dO2))} ${Math.abs(r.cell.dO2) === 1 ? "pt" : "pts"} ${r.cell.dO2 > 0 ? "above" : "below"} NASA`}
                                {r.cell.pressureRecorded ? "" : "; no pressure data"}
                                {r.cell.covered && !r.cell.exactMaterial ? "; NASA tested a different solid" : ""}
                              </span>
                            </>
                          ) : r.status === "ambiguous" ? "List each material on its own line." : "Nothing to compare with"}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.cell && (
                            <button type="button" onClick={() => onOpen(r.cell!.target)}
                              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200">Open</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={download}
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200">Download results (.csv)</button>
              </div>
            </>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Matching is by name, so check that a match is the product you mean. &ldquo;Covered&rdquo; means NASA&apos;s closest flammability record is
            within 2 points of your oxygen level and scores at least 65%; it describes what NASA tested, not whether a material is safe.
            &ldquo;No NASA record&rdquo; means FlameBound found no microgravity flammability test of that material in NASA&apos;s open PSI data as ingested here.
          </p>
        </div>
      )}
    </section>
  );
}
