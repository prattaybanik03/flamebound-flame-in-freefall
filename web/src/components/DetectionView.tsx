// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Detection pillar: NASA's microgravity smoke tests (SAME, SAME-R) for the selected material.
// Not scored: NASA's tables record how each smoke sample was made, not detector responses, so a
// match score would claim more than the data holds. Conditions are shown verbatim, nearest airflow first.
import { useMemo } from "react";
import type { Bundle, Target } from "@/lib/types";
import { MATERIAL_OPTIONS } from "@/lib/presets";

export default function DetectionView({
  bundle, target, onChange,
}: { bundle: Bundle; target: Target; onChange: (patch: Partial<Target>) => void }) {
  const { smoke, invById, available } = useMemo(() => {
    const invById = new Map(bundle.investigations.map((i) => [i.id, i]));
    const smoke = bundle.records.filter((r) => invById.get(r.inv)?.pillar === "detection");
    const counts = new Map<string, number>();
    for (const r of smoke) for (const k of r.materialKeys) counts.set(k, (counts.get(k) ?? 0) + 1);
    const available = MATERIAL_OPTIONS.filter((m) => counts.has(m.key)).map((m) => ({ ...m, n: counts.get(m.key)! }));
    return { smoke, invById, available };
  }, [bundle]);

  const matched = useMemo(() => {
    const flowOf = (v: number | null) => (v === null ? Infinity : Math.abs(v - target.flowCmS));
    return smoke
      .filter((r) => r.materialKeys.includes(target.materialKey))
      .sort((a, b) => flowOf(a.flow.min) - flowOf(b.flow.min));
  }, [smoke, target.materialKey, target.flowCmS]);

  const label = MATERIAL_OPTIONS.find((m) => m.key === target.materialKey)?.label ?? target.materialKey;
  const extraCols = ["Heater level (Rt/R0)", "Net aging time (s)", "Weight loss rate (mg/min)", "Aging duration (min)", "Description"];
  const cols = extraCols.filter((c) => matched.some((r) => r.outcome?.fields?.[c]));

  return (
    <section aria-label="Smoke detection evidence" className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-lg text-slate-100">NASA smoke tests for {label}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Not scored. NASA&apos;s SAME and SAME-R tables record how each smoke sample was made in microgravity: the material,
        the airflow, how hot the heater ran and how long the smoke aged. The particle-size results are in the
        investigations&apos; publications, linked by DOI. Only material and airflow apply here: NASA did not record O₂ or
        pressure for these tests, and all were flown in microgravity.
      </p>

      {matched.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-slate-200">NASA made no smoke from {label} in these investigations. It did test:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {available.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onChange({ materialKey: m.key })}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:border-orange-400 hover:text-orange-200"
              >
                {m.label} ({m.n} tests)
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-slate-300">
            {matched.length} smoke test{matched.length === 1 ? "" : "s"}, nearest to your {target.flowCmS} cm/s airflow first.
          </p>
          <div className="mt-2 max-h-[28rem] overflow-auto rounded-md border border-slate-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-900 text-xs text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-normal">Investigation and test</th>
                  <th scope="col" className="px-3 py-2 font-normal">Material (NASA)</th>
                  <th scope="col" className="px-3 py-2 font-normal">Airflow (NASA cell)</th>
                  {cols.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-normal">{c}</th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((r) => {
                  const inv = invById.get(r.inv)!;
                  return (
                    <tr key={r.id} className="border-t border-slate-800/70">
                      <td className="px-3 py-2 text-slate-100">
                        {inv.acronym} <span className="font-mono text-xs text-slate-400">{r.ref}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-300">{r.material}</td>
                      <td className="px-3 py-2 text-slate-200">{r.flow.raw ? `${r.flow.raw} cm/s` : "not recorded"}</td>
                      {cols.map((c) => (
                        <td key={c} className="px-3 py-2 text-slate-300">{r.outcome?.fields?.[c] || "—"}</td>
                      ))}
                      <td className="px-3 py-2">
                        <a
                          href={inv.doiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
                        >
                          DOI
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Rt/R0 is NASA&apos;s heater resistance ratio; a higher value means a hotter heater. Values are copied from
            NASA&apos;s tables unchanged.
          </p>
        </>
      )}
    </section>
  );
}
