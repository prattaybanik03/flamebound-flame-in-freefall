"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// SI evidence briefing panel. On demand (to control API cost), keyed to the scenario: any change
// to the target clears the briefing. The label always says whether the text came from SI
// (verified) or from the deterministic fallback, as NASA's SI disclosure rules require.
import { useState } from "react";
import type { Target } from "@/lib/types";
import { searchFromTarget } from "@/lib/url";

interface BriefResponse {
  source: "si" | "fallback";
  model: string | null;
  provider?: string | null;
  sentences: { text: string; cites: string[] }[];
  evidence: { id: string; label: string; doi: string; doiUrl: string; portalUrl: string }[];
  problems: string[];
  note: string;
}

export default function SiBriefing({ target }: { target: Target }) {
  const scenario = searchFromTarget(target);
  const [state, setState] = useState<{ scenario: string; data: BriefResponse | null; loading: boolean; error: string | null }>({
    scenario, data: null, loading: false, error: null,
  });
  // A briefing belongs to one scenario: show nothing stale after the target changes.
  const current = state.scenario === scenario ? state : { scenario, data: null, loading: false, error: null };

  const generate = async () => {
    setState({ scenario, data: null, loading: true, error: null });
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: scenario }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BriefResponse;
      setState({ scenario, data, loading: false, error: null });
    } catch (e) {
      setState({ scenario, data: null, loading: false, error: e instanceof Error ? e.message : "Request failed" });
    }
  };

  const byId = new Map((current.data?.evidence ?? []).map((e) => [e.id, e]));
  const isSi = current.data?.source === "si";

  return (
    <section aria-label="SI evidence briefing" className="rounded-lg border border-violet-800/70 bg-violet-950/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">SI evidence briefing</h2>
          <p className="mt-1 max-w-3xl text-xs text-slate-400">
            Super intelligence summarises and interprets the top NASA records for this scenario. It never ranks or
            rescores. Every sentence must cite a record, every number is checked against NASA&apos;s data, and safety
            verdicts are rejected.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={current.loading}
          className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-violet-400 disabled:opacity-60"
        >
          {current.loading ? "Generating…" : current.data ? "Regenerate" : "Generate SI briefing"}
        </button>
      </div>

      {current.error && <p role="alert" className="mt-3 text-sm text-red-300">Could not get a briefing ({current.error}).</p>}

      {current.data && (
        <div className="mt-4">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded border px-1.5 py-0.5 ${
                isSi ? "border-violet-600 bg-violet-500/15 text-violet-200" : "border-slate-600 text-slate-300"
              }`}
            >
              {isSi ? `SI-generated · ${current.data.model} · verified` : "Deterministic brief (no SI)"}
            </span>
            <span className="text-slate-400">{current.data.note}</span>
          </p>
          <ol className="space-y-2 text-sm text-slate-200">
            {current.data.sentences.map((s, i) => (
              <li key={i}>
                {s.text.replace(/\s*(\[E\d+\])+\s*$/, "").replace(/\[E\d+\]/g, "")}{" "}
                {s.cites.map((c) => {
                  const e = byId.get(c);
                  return e ? (
                    <a
                      key={c}
                      href={e.doiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${e.label} · DOI ${e.doi}`}
                      className="ml-0.5 rounded bg-slate-800 px-1 font-mono text-[11px] text-sky-300 hover:text-sky-200"
                    >
                      {c}
                    </a>
                  ) : null;
                })}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Sources:{" "}
            {current.data.evidence.map((e, i) => (
              <span key={e.id}>
                {i > 0 && " · "}
                <span className="font-mono">{e.id}</span> {e.label}
              </span>
            ))}
          </p>
          {current.data.problems.length > 0 && (
            <details className="mt-2 text-xs text-amber-300">
              <summary>Why the SI draft was rejected</summary>
              <ul className="mt-1 list-disc pl-5">
                {current.data.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
