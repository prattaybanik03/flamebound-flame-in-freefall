// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Verdict card (BUILD_PLAN A5 + amendment 4). Renders buildVerdict() output only: cited
// NASA records, verbatim facts, no computed conclusion. When gated by the Extrapolation
// Hazard, evidence is presented as nearest NASA observations with no claim about the cabin.
import type { Verdict, VerdictEvidence } from "@/lib/verdict";
import { ROW_TITLE, rowLabel } from "./ResultCard";

const LINK = "text-sky-300 underline decoration-sky-700 hover:text-sky-200";

function Evidence({ e }: { e: VerdictEvidence }) {
  return (
    <article className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-300">
          NASA table
        </span>
        <span className="text-sm font-medium text-slate-100">
          {e.acronym} <span className="font-mono text-slate-400">{e.recordRef}</span>
        </span>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">NASA&apos;s values (verbatim)</h4>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {e.facts.map((f) => (
              <div key={f.label} className="contents">
                <dt className="text-slate-500">{f.label}</dt>
                <dd className="text-slate-200">
                  {f.status === "suspect" ? (
                    <>
                      <span className="rounded border border-amber-600 bg-amber-500/15 px-1 font-medium text-amber-300">
                        Withheld: suspect source value
                      </span>{" "}
                      <span className="text-slate-500">(raw &quot;{f.value}&quot;, not used)</span>
                    </>
                  ) : f.status === "unparsed" ? (
                    <>
                      <span className="rounded border border-slate-600 px-1 text-slate-300">Unreadable source value</span>{" "}
                      <span className="text-slate-500">(raw &quot;{f.value}&quot;)</span>
                    </>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Differences from your target</h4>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {e.targetDeltas.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-slate-500">{d.label}</dt>
                <dd className="text-slate-200">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {e.reading && <p className="mt-3 text-sm font-semibold text-slate-100">{e.reading}</p>}

      <p className="mt-3 text-xs text-slate-400">
        {e.acronym} · {e.recordRef} · {e.table} · <span title={ROW_TITLE}>{rowLabel(e.row)}</span> ·{" "}
        <a href={e.doiUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
          DOI {e.doi}
        </a>
      </p>
    </article>
  );
}

export default function VerdictCard({ verdict }: { verdict: Verdict }) {
  const { available, gated, evidence, related, message } = verdict;
  return (
    <section aria-label="1 g screening verdict" className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-lg font-semibold text-slate-100">Is 1 g screening conservative here? Cited NASA evidence only</h2>

      {!available ? (
        <p className="mt-2 text-sm text-slate-300">{message}</p>
      ) : (
        <>
          {gated ? (
            <p role="alert" className="mt-3 rounded-md border border-red-800 bg-red-950/40 p-3 text-sm font-medium text-red-200">
              {message}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-300">{message}</p>
          )}
          {gated && <h3 className="mt-4 text-sm font-medium text-slate-200">Nearest NASA observations</h3>}
          <div className="mt-3 flex flex-col gap-3">
            {evidence.map((e) => (
              <Evidence key={`${e.investigationId}:${e.table}:${e.row}`} e={e} />
            ))}
          </div>
        </>
      )}

      {related.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-medium text-slate-200">Related NASA findings (not a gravity comparison)</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {related.map((r) => (
              <li key={r.investigationId} className="text-xs text-slate-300">
                <span className="mr-2 rounded border border-slate-600 px-1.5 py-0.5 text-slate-300">NASA written finding</span>
                <span className="font-medium text-slate-100">{r.acronym}</span>
                <blockquote className="mt-1 border-l-2 border-slate-700 pl-3 text-slate-400">{r.text}</blockquote>
                <a href={r.doiUrl} target="_blank" rel="noopener noreferrer" className={`mt-1 inline-block ${LINK}`}>
                  DOI {r.doi}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
