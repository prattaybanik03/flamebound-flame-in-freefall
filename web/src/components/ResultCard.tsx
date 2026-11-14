// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Result card (BUILD_PLAN A4). Every number shown is either a NASA raw cell (verbatim)
// or a computed BCMS quantity. NASA values are never rounded; the raw cell is shown.
import type { Component, Scored } from "@/lib/bcms";
import type { Condition, PsiRecord, Target } from "@/lib/types";
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

const CANON_UNIT: Partial<Record<Component["dim"], string>> = { o2: "% O₂", flow: "cm/s", pressure: "kPa" };

/** Canonical value(s) a NASA cell was converted to, for display beside the verbatim cell. */
function canonical(cond: Condition, dim: Component["dim"]): string | null {
  const u = CANON_UNIT[dim];
  if (!u) return null;
  if (cond.levels.length) return `${cond.levels.map((v) => fmt(v)).join(", ")} ${u}`;
  if (cond.min === null || cond.max === null) return null;
  return cond.min === cond.max ? `${fmt(cond.min)} ${u}` : `${fmt(cond.min)}–${fmt(cond.max)} ${u}`;
}

/** "NASA cell "0.21" (column "XO2") → 21 % O₂" so a converted delta is never shown beside a unitless raw value. */
export function basisText(c: Component, cond?: Condition): string {
  if (c.score === null || !cond || !c.raw) return c.basis;
  const canon = canonical(cond, c.dim);
  const col = c.col ? ` (column "${c.col}")` : "";
  return `NASA cell "${c.raw}"${col}${canon ? ` → ${canon}` : ""}`;
}

const SINGLE = new Set(["recorded", "approx", "footnote"]);

/** O2 partial pressure derived from a record's own single-valued O2 and pressure (context, not scored). */
function partialPressure(r: PsiRecord): string | null {
  const { o2, pressure: p } = r;
  if (!SINGLE.has(o2.status) || !SINGLE.has(p.status) || o2.levels.length || p.levels.length) return null;
  if (o2.min === null || o2.min !== o2.max || p.min === null || p.min !== p.max) return null;
  return ((o2.min / 100) * p.min).toFixed(1);
}

/** NASA's recorded flow direction for the record, when the table gives one. */
function recordDirection(r: PsiRecord): string | null {
  const v = r.outcome?.fields?.["Flow direction"]?.trim();
  return v ? v : null;
}

function Bar({ c, cond }: { c: Component; cond?: Condition }) {
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
      <span className="col-start-2 text-xs text-slate-500 sm:col-span-2">{basisText(c, cond)}</span>
    </li>
  );
}

export default function ResultCard({ scored, rank, next, target }: { scored: Scored; rank: number; next?: Scored | null; target?: Target }) {
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
              <span className="font-mono text-sm text-slate-500" title="Overall rank by BCMS across all pillars">
                #{rank}
              </span>
              <h3 className="text-lg font-semibold text-slate-100">{inv.acronym}</h3>
              <span className={`rounded border px-1.5 py-0.5 text-xs capitalize ${PILLAR_BADGE[inv.pillar]}`}>{inv.pillar}</span>
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
                {inv.scale === "full" ? "full-scale" : "chamber"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">{inv.title}</p>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl leading-none tabular-nums text-orange-300">{scored.bcms}%</div>
            <div className="text-xs text-slate-500">BCMS</div>
          </div>
        </header>

        <ul className="mt-4 space-y-2.5" aria-label="Score breakdown">
          {scored.components.map((c) => (
            <Bar key={c.dim} c={c} cond={c.dim === "o2" || c.dim === "flow" || c.dim === "pressure" ? r[c.dim] : undefined} />
          ))}
        </ul>

        <p className="mt-4 text-xs text-slate-400">
          {unit} <span className="font-mono text-slate-300">{r.ref}</span> · {r.table} ·{" "}
          <span title={ROW_TITLE}>{rowLabel(r.row)}</span>
          {r.material ? ` · ${r.material}` : ""}
          {r.materialNote ? ` (${r.materialNote})` : ""}
        </p>
        {(() => {
          const pp = partialPressure(r);
          return pp ? (
            <p className="mt-1 text-xs text-slate-500">
              O₂ partial pressure (derived from NASA&apos;s O₂ and pressure): {pp} kPa · context, not scored
            </p>
          ) : null;
        })()}
        {(() => {
          const dir = recordDirection(r);
          if (!dir || !target || dir.toLowerCase().includes(target.flowDirection)) return null;
          return (
            <p className="mt-2 rounded border border-amber-700/60 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
              Flow direction differs: NASA&apos;s test ran <strong>{dir}</strong>; you selected <strong>{target.flowDirection}</strong>.
              Concurrent and opposed flame spread behave differently, so treat this match with care. Not scored.
            </p>
          );
        })()}

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
