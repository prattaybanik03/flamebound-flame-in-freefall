// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Headline (BUILD_PLAN A3): the best match in the ACTIVE pillar, with its coverage.
import type { Dim, Scored } from "@/lib/bcms";
import type { Target } from "@/lib/types";

const DIM_LABEL: Record<Dim, string> = {
  o2: "O₂",
  material: "material",
  flow: "airflow",
  pressure: "pressure",
  pillar: "pillar",
};

export default function Headline({ best, target }: { best: Scored | null; target: Target }) {
  return (
    <section aria-label="Best match" className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      {best ? (
        <>
          <p className="text-sm uppercase tracking-wide text-slate-400">Best {target.pillar} match</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-5xl font-semibold tabular-nums text-orange-300">{best.bcms}%</span>
            <span className="text-lg font-medium text-slate-100">{best.investigation.acronym}</span>
            <span className="font-mono text-sm text-slate-400">{best.record.ref}</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{best.investigation.title}</p>
          <p className="mt-2 text-sm text-slate-400">
            Evidence covers {Math.round(best.coverage * 100)}% of the score weight
            {(() => {
              const missing = best.components.filter((c) => c.score === null).map((c) => DIM_LABEL[c.dim]);
              return missing.length ? `: ${missing.join(", ")} not recorded` : "";
            })()}
            .
          </p>
        </>
      ) : (
        <p className="text-slate-300">No {target.pillar} investigation in the PSI data is available to match.</p>
      )}
      <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
        No warning does not mean safe. BCMS measures how closely NASA data covers your conditions, not fire safety.
      </p>
    </section>
  );
}
