// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Result card (BUILD_PLAN A4). Every number shown is either a NASA raw cell (verbatim)
// or a computed BCMS quantity. NASA values are never rounded; the raw cell is shown.
import type { Component, Scored } from "@/lib/bcms";
import { DIM_LABEL, fmt, whyAbove } from "@/lib/explain";

const UNIT: Partial<Record<Component["dim"], string>> = { o2: "% pts", flow: "cm/s", pressure: "kPa" };

const PILLAR_BADGE: Record<string, string> = {
  flammability: "bg-orange-500/15 text-orange-300 border-orange-700",
  suppression: "bg-sky-500/15 text-sky-300 border-sky-700",
  detection: "bg-violet-500/15 text-violet-300 border-violet-700",
  fundamentals: "bg-slate-500/15 text-slate-300 border-slate-600",
};

/** Data-row label: the bundle stores a 0-based index into NASA's CSV, header excluded. */
export function rowLabel(row: number) {
  return `data row ${row + 1}`;
}
export const ROW_TITLE = "1-based data row in NASA's CSV, header row excluded";

function Bar({ c }: { c: Component }) {
  const recorded = c.score !== null;
  const pct = recorded ? Math.round(c.score! * 100) : 0;
  const unit = UNIT[c.dim];
  const hover = c.raw || c.col ? `NASA cell: "${c.raw ?? ""}"${c.col ? `, column "${c.col}"` : ""}` : undefined;
  return (
    <li className="grid grid-cols-[7.5rem_1fr] items-start gap-x-3 gap-y-0.5 sm:grid-cols-[9rem_1fr_9rem]" title={hover}>
      <span className="text-xs text-slate-300">
        {DIM_LABEL[c.dim]} <span className="text-slate-500">· w {Math.round(c.weight * 100)}%</span>
      </span>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        {recorded ? (
          <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
        ) : (
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#334155_0_4px,#1e293b_4px_8px)]" />
        )}
      </div>
      <span className="col-start-2 text-xs tabular-nums text-slate-300 sm:col-start-auto sm:text-right">
        {recorded ? `${pct}%` : <span className="text-slate-500">not recorded</span>}
        {recorded && c.delta !== null && unit ? ` · Δ${fmt(c.delta)} ${unit}` : ""}
      </span>
      <span className="col-start-2 text-xs text-slate-500 sm:col-span-2">{c.basis}</span>
    </li>
  );
}

export default function ResultCard({ scored, rank, next }: { scored: Scored; rank: number; next?: Scored | null }) {
  const { record: r, investigation: inv } = scored;
  const unit = inv.recordsNotTests ? "Record" : "Test";
  const outcome = Object.entries(r.outcome?.fields ?? {}).filter(([, v]) => v.trim() !== "");

  let why: string | null = null;
  if (next) {
    // Only claim "ranks above" when it actually scores higher; ties are ordered by investigation ID.
    why =
      scored.bcms > next.bcms
        ? whyAbove(scored, next).text
        : `${inv.acronym} ${r.ref} and ${next.investigation.acronym} ${next.record.ref} tie at ${scored.bcms}% BCMS; order is by investigation ID.`;
  }

  return (
    <>
      <article className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-slate-500">#{rank}</span>
              <h3 className="text-lg font-semibold text-slate-100">{inv.acronym}</h3>
              <span className={`rounded border px-1.5 py-0.5 text-xs capitalize ${PILLAR_BADGE[inv.pillar]}`}>{inv.pillar}</span>
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                {inv.scale === "full" ? "full-scale" : "chamber"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">{inv.title}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums text-orange-300">{scored.bcms}%</div>
            <div className="text-xs text-slate-500">BCMS</div>
          </div>
        </header>

        <ul className="mt-4 space-y-2.5" aria-label="Score breakdown">
          {scored.components.map((c) => (
            <Bar key={c.dim} c={c} />
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-400">
          {unit} <span className="font-mono text-slate-300">{r.ref}</span> · {r.table} ·{" "}
          <span title={ROW_TITLE}>{rowLabel(r.row)}</span>
          {r.material ? ` · ${r.material}` : ""}
          {r.materialNote ? ` (${r.materialNote})` : ""}
        </p>

        {outcome.length > 0 && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {outcome.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-200">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-3 flex flex-wrap gap-4 text-xs">
          <a href={inv.doiUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline decoration-sky-700 hover:text-sky-200">
            DOI {inv.doi}
          </a>
          <a href={inv.portalUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline decoration-sky-700 hover:text-sky-200">
            NASA PSI portal
          </a>
        </p>
      </article>
      {why && <p className="-mt-2 px-2 text-xs italic text-slate-400">↓ {why}</p>}
    </>
  );
}
