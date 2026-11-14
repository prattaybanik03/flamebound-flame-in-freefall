"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// App shell: loads the PSI data bundle (built by scripts/build_app_data.py) once on mount.

import { useEffect, useMemo, useState } from "react";
import type { Bundle, Target } from "@/lib/types";
import { DEFAULT_TARGET } from "@/lib/presets";
import { hazard as computeHazard, rank } from "@/lib/bcms";
import Controls from "./Controls";
import Headline from "./Headline";
import HazardBanner from "./HazardBanner";

const DATA_URL = "/data/pyrovector.json";

function isBundle(x: unknown): x is Bundle {
  const b = x as Partial<Bundle> | null;
  return !!b && Array.isArray(b.investigations) && Array.isArray(b.records) && typeof b.builtOn === "string";
}

export default function PyroVector() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Target conditions: the single source of truth for ranking (A3+).
  const [target, setTarget] = useState<Target>(DEFAULT_TARGET);

  const ranked = useMemo(
    () => (bundle ? rank(bundle.records, bundle.investigations, target) : []),
    [bundle, target],
  );
  const hazard = useMemo(() => (bundle ? computeHazard(ranked, target) : null), [bundle, ranked, target]);
  // Headline is the best match in the ACTIVE pillar (locked Sat 11:20).
  const best = useMemo(() => ranked.find((s) => s.investigation.pillar === target.pillar) ?? null, [ranked, target.pillar]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(DATA_URL, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${DATA_URL}`);
        return res.json();
      })
      .then((json: unknown) => {
        if (!isBundle(json)) throw new Error("Data bundle has an unexpected shape");
        if (process.env.NODE_ENV !== "production") {
          console.log(`PyroVector data: ${json.investigations.length} investigations, ${json.records.length} records`);
        }
        setBundle(json);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load data");
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = () => {
    setError(null);
    setBundle(null);
    setAttempt((n) => n + 1);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">PyroVector</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          NASA microgravity combustion investigations, matched to your habitat conditions and cited to their DOIs.
        </p>
      </header>

      <Controls target={target} onChange={setTarget} />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-4">
          <p className="font-medium text-red-300">Could not load the NASA data bundle.</p>
          <p className="mt-1 text-sm text-red-200/80">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-white"
          >
            Retry
          </button>
        </div>
      ) : !bundle ? (
        <p role="status" className="text-slate-400">
          Loading NASA PSI data…
        </p>
      ) : (
        <>
          {hazard && (
            <HazardBanner
              hazard={hazard}
              records={bundle.records}
              investigations={bundle.investigations}
              target={target}
            />
          )}
          <Headline best={best} target={target} />
          <p className="text-sm text-slate-400">
            {bundle.investigations.length} investigations · {bundle.records.length.toLocaleString("en-AU")} records ·
            data snapshot {bundle.builtOn}
          </p>
        </>
      )}
    </main>
  );
}
