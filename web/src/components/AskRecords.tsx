"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// "Ask NASA's records": cross-cutting questions answered from the 23 PSI investigation records.
// The label always says whether the text is an SI answer that passed automated checks, a refusal, or retrieved passages only.
import { useState, type FormEvent } from "react";

interface Passage { id: string; psi: string; acronym: string; field: string; doi: string; text: string }
interface AskResponse {
  source: "si" | "refusal" | "fallback";
  model: string | null;
  sentences: { text: string; cites: string[] }[];
  passages: Passage[];
  problems: string[];
  note: string;
}

const EXAMPLES = [
  "Which fire suppressants did NASA test in microgravity?",
  "Is the 1 g upward-burning screening test conservative in space?",
  "How rapidly does a large fire grow in low gravity?",
  "What did NASA measure about smoke particles in microgravity?",
];

export default function AskRecords() {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<{ loading: boolean; data: AskResponse | null; error: string | null; asked: string }>({
    loading: false, data: null, error: null, asked: "",
  });

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 3) return;
    setQuestion(text);
    setState({ loading: true, data: null, error: null, asked: text });
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text }) });
      const data = (await res.json()) as AskResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setState({ loading: false, data, error: null, asked: text });
    } catch (e) {
      setState({ loading: false, data: null, error: e instanceof Error ? e.message : "Request failed", asked: text });
    }
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); void ask(question); };

  const d = state.data;
  const byId = new Map((d?.passages ?? []).map((p) => [p.id, p]));
  const badge =
    d?.source === "si" ? `SI answer · ${d.model} · automated checks passed` : d?.source === "refusal" ? "Not in NASA's records" : "Closest NASA passages (no SI answer)";

  return (
    <section id="ask" aria-label="Ask NASA's records" className="scroll-mt-16 rounded-lg border border-violet-800 bg-violet-950/60 p-5">
      <h2 className="text-lg text-slate-100">Ask NASA&apos;s records</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">
        Questions across all 23 investigations. SI answers only from the NASA passages it retrieves: every sentence must cite
        one, quoted words must match NASA&apos;s text exactly, every number must appear in the cited passage, and it says so
        when the records don&apos;t cover a question.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="ask-q" className="sr-only">Your question</label>
        <input
          id="ask-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="e.g. Which experiments studied cool flames?"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={state.loading || question.trim().length < 3}
          className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-violet-400 disabled:opacity-60"
        >
          {state.loading ? "Searching…" : "Ask"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void ask(q)}
            disabled={state.loading}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-violet-400 hover:text-violet-200"
          >
            {q}
          </button>
        ))}
      </div>

      {state.error && <p role="alert" className="mt-3 text-sm text-red-300">Could not get an answer ({state.error}).</p>}

      {d && (
        <div className="mt-4" aria-live="polite">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded border px-1.5 py-0.5 ${d.source === "si" ? "border-violet-600 bg-violet-500/15 text-violet-200" : "border-slate-600 text-slate-300"}`}>
              {badge}
            </span>
            <span className="text-slate-400">{d.note}</span>
          </p>
          <p className="text-xs text-slate-400">Q: {state.asked}</p>
          {d.sentences.length > 0 && (
            <ol className="mt-2 space-y-2 text-sm text-slate-200">
              {d.sentences.map((s, i) => (
                <li key={i}>
                  {s.text.replace(/\s*(\[P\d+\])+\s*(?=[.!?]?$)/, "").replace(/\[P\d+\]/g, "")}{" "}
                  {s.cites
                    .filter((c, j, all) => all.findIndex((x) => byId.get(x)?.acronym === byId.get(c)?.acronym) === j)
                    .map((c) => {
                    const p = byId.get(c);
                    return p ? (
                      <a key={c} href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" title={`${p.acronym} ${p.field} · DOI ${p.doi}`}
                        className="ml-0.5 rounded bg-slate-800 px-1 font-mono text-[11px] text-sky-300 hover:text-sky-200">
                        {p.acronym}
                      </a>
                    ) : null;
                  })}
                </li>
              ))}
            </ol>
          )}
          {d.passages.length > 0 && (
            <details className="mt-3" open={d.source === "fallback"}>
              <summary className="cursor-pointer text-xs text-slate-300">
                {d.source === "fallback" ? "NASA passages retrieved for this question" : "NASA passages cited"} ({d.passages.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {d.passages.map((p) => (
                  <li key={p.id} className="rounded-md border-l-2 border-violet-400 bg-slate-950/50 py-2 pl-3 pr-2 text-sm">
                    <p className="text-slate-200">&ldquo;{p.text}&rdquo;</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {p.acronym} {p.field}, {p.psi},{" "}
                      <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">
                        DOI {p.doi}
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {d.problems.length > 0 && (
            <details className="mt-2 text-xs text-amber-300">
              <summary>Why the SI answer was rejected</summary>
              <ul className="mt-1 list-disc pl-5">{d.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
