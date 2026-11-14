// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Extrapolation hazard banner (BUILD_PLAN A3, P5). Red for hazard, blue for info.
// For a hazard it lists the nearest recorded NASA conditions below/above the target
// (not physical safety bounds; different materials can appear, so each shows its material).
import { useMemo } from "react";
import { bounds, type Bound, type Hazard } from "@/lib/bcms";
import type { Investigation, PsiRecord, Target } from "@/lib/types";

type BoundDim = "o2" | "flow" | "pressure";

const DIM_META: Record<BoundDim, { label: string; unit: string }> = {
  o2: { label: "O₂", unit: "%" },
  flow: { label: "Airflow", unit: "cm/s" },
  pressure: { label: "Pressure", unit: "kPa" },
};

const fmt = (n: number) => String(Number(n.toFixed(2)));
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");

function targetValue(t: Target, dim: BoundDim) {
  return dim === "o2" ? t.o2Pct : dim === "flow" ? t.flowCmS : t.pressureKPa;
}

function BoundLine({ side, b, dim, target }: { side: "below" | "above"; b: Bound | null; dim: BoundDim; target: Target }) {
  const { unit } = DIM_META[dim];
  const heading = side === "below" ? "Nearest below" : "Nearest above";
  if (!b) {
    return (
      <li className="text-sm text-slate-300">
        <span className="font-medium">{heading}:</span> no recorded NASA value in this pillar.
      </li>
    );
  }
  const comp = b.scored.components.find((c) => c.dim === dim);
  const inv = b.scored.investigation;
  return (
    <li className="text-sm text-slate-300">
      <span className="font-medium">{heading}:</span> {inv.acronym}{" "}
      <span className="font-mono text-xs text-slate-400">{b.scored.record.ref}</span>
      {b.scored.record.material ? `, ${b.scored.record.material}` : ""}: {fmt(b.value)} {unit} (Δ{" "}
      {signed(b.value - targetValue(target, dim))} {unit}
      {comp?.raw ? `; NASA cell "${comp.raw}"` : ""}){" "}
      <a href={inv.doiUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-500 hover:text-white">
        DOI
      </a>
    </li>
  );
}

export default function HazardBanner(props: {
  hazard: Hazard;
  records: PsiRecord[];
  investigations: Investigation[];
  target: Target;
}) {
  const { hazard, records, investigations, target } = props;
  const isHazard = hazard.level === "hazard";

  const found = useMemo(() => {
    if (!isHazard) return [];
    // O2 and airflow for Flammability; O2 and pressure for Suppression.
    const dims: BoundDim[] = target.pillar === "flammability" ? ["o2", "flow"] : ["o2", "pressure"];
    return dims.map((d) => ({ dim: d, ...bounds(records, investigations, target, d) }));
  }, [isHazard, records, investigations, target]);

  return (
    <section
      role={isHazard ? "alert" : "note"}
      aria-label={isHazard ? "Extrapolation hazard" : "Gravity note"}
      className={`rounded-lg border border-l-4 p-4 ${
        isHazard ? "border-red-800 border-l-[#ff5a4f] bg-red-950/40" : "border-sky-800 border-l-sky-400 bg-sky-950/40"
      }`}
    >
      {isHazard ? (
        <h2 className="flex flex-wrap items-center gap-3 text-lg text-red-200">
          <span className="annunciator text-sm">EXTRAP HAZARD</span>
          No verdict from NASA data
        </h2>
      ) : (
        <h2 className="text-lg text-sky-300">Microgravity data only</h2>
      )}
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
        {hazard.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      {isHazard && (
        <div className="mt-4 border-t border-red-900/60 pt-3">
          <h3 className="text-sm font-medium text-slate-100">Nearest recorded NASA conditions below/above your value</h3>
          <p className="mt-1 text-xs text-slate-400">
            These are the closest recorded values, not physical safety bounds. Materials and configurations differ.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {found.map(({ dim, below, above }) => (
              <div key={dim}>
                <p className="text-sm font-medium text-slate-100">
                  {DIM_META[dim].label} (your value {fmt(targetValue(target, dim))} {DIM_META[dim].unit})
                </p>
                <ul className="mt-1 space-y-1">
                  <BoundLine side="below" b={below} dim={dim} target={target} />
                  <BoundLine side="above" b={above} dim={dim} target={target} />
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
