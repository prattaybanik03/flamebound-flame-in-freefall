"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// App shell: loads the PSI data bundle (built by scripts/build_app_data.py) once on mount.

import { useEffect, useMemo, useState } from "react";
import type { Bundle, Target } from "@/lib/types";
import { DEFAULT_TARGET, MATERIAL_OPTIONS } from "@/lib/presets";
import { hazard as computeHazard, rank, scoreRecord } from "@/lib/bcms";
import { buildVerdict } from "@/lib/verdict";
import { searchFromTarget, targetFromSearch } from "@/lib/url";
import VerdictCard from "./VerdictCard";
import RegimeMap from "./RegimeMap";
import Method from "./Method";
import Controls from "./Controls";
import Headline from "./Headline";
import HazardBanner from "./HazardBanner";
import ResultCard from "./ResultCard";
import SiBriefing from "./SiBriefing";
import NasaContext from "./NasaContext";
import ValidationPanel from "./ValidationPanel";
import ReportButtons from "./ReportButtons";
import DetectionView from "./DetectionView";

const DATA_URL = "/data/flamebound.json";
const MATERIAL_KEYS: ReadonlySet<string> = new Set(MATERIAL_OPTIONS.map((m) => m.key));

function isBundle(x: unknown): x is Bundle {
  const b = x as Partial<Bundle> | null;
  return !!b && Array.isArray(b.investigations) && Array.isArray(b.records) && typeof b.builtOn === "string";
}

export default function FlameBound() {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Target conditions: the single source of truth for ranking (A3+).
  const [target, setTarget] = useState<Target>(DEFAULT_TARGET);
  // Shareable scenarios: read the URL once on mount, then keep it in sync with the target.
  const [urlReady, setUrlReady] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!urlReady) return;
    window.history.replaceState(null, "", `${window.location.pathname}?${searchFromTarget(target)}`);
  }, [target, urlReady]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const ranked = useMemo(
    () => (bundle ? rank(bundle.records, bundle.investigations, target) : []),
    [bundle, target],
  );
  const hazard = useMemo(() => (bundle ? computeHazard(ranked, target) : null), [bundle, ranked, target]);
  // Headline is the best match in the ACTIVE pillar (locked Sat 11:20).
  const best = useMemo(() => ranked.find((s) => s.investigation.pillar === target.pillar) ?? null, [ranked, target.pillar]);
  // Verdict (A5): every record scored, then cited evidence only, gated by the hazard (amendment 4).
  const verdict = useMemo(() => {
    if (!bundle) return null;
    const byId = new Map(bundle.investigations.map((i) => [i.id, i]));
    const allScored = bundle.records.flatMap((r) => {
      const inv = byId.get(r.inv);
      return inv ? [scoreRecord(r, inv, target)] : [];
    });
    return buildVerdict(ranked, allScored, target.materialKey, hazard?.level ?? null);
  }, [bundle, ranked, target, hazard]);
  // Result cards (A4): top 8 overall, active-pillar first, then other pillars as supporting evidence.
  // The headline's record (best in the active pillar) is always shown: if it falls outside
  // the top 8, it takes the 8th slot. Order and BCMS within each section stay as ranked.
  const displayed = useMemo(() => {
    const top = ranked.slice(0, 8);
    if (!best || top.includes(best)) return top;
    return [...ranked.slice(0, 7), best];
  }, [ranked, best]);
  const [activeCards, otherCards] = useMemo(
    () => [
      displayed.filter((s) => s.investigation.pillar === target.pillar),
      displayed.filter((s) => s.investigation.pillar !== target.pillar),
    ],
    [displayed, target.pillar],
  );
  // Map highlights exactly the records shown as cards.
  const highlight = useMemo(() => new Set(displayed.map((s) => s.record.id)), [displayed]);

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
          console.log(`FlameBound data: ${json.investigations.length} investigations, ${json.records.length} records`);
        }
        // Apply a shared scenario from the URL (if any) once the data is ready, then start syncing.
        const fromUrl = targetFromSearch(window.location.search, MATERIAL_KEYS);
        if (Object.keys(fromUrl).length) setTarget((t) => ({ ...t, ...fromUrl }));
        setBundle(json);
        setUrlReady(true);
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
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="ug-flame" aria-hidden="true" />
            <h1 className="text-4xl leading-none text-slate-50">FlameBound</h1>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            NASA microgravity combustion investigations, matched to your habitat conditions and cited to their DOIs.
            Without gravity, a candle flame burns as a dim blue sphere. FlameBound shows how far NASA&apos;s flight data covers your cabin.
          </p>
        </div>
        <nav aria-label="Scenario actions" className="flex flex-wrap gap-2 md:max-w-sm md:justify-end">
          <button
            type="button"
            onClick={copyLink}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200"
          >
            {copied ? "Link copied" : "Copy scenario link"}
          </button>
          <a
            href="#validation"
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-orange-400 hover:text-orange-200"
          >
            Validation
          </a>
          {bundle && target.pillar !== "detection" && <ReportButtons target={target} ranked={ranked} hazard={hazard} builtOn={bundle.builtOn} />}
        </nav>
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
          {target.pillar === "detection" ? (
            <>
              <NasaContext target={target} />
              <DetectionView bundle={bundle} target={target} onChange={(patch) => setTarget((t) => ({ ...t, ...patch }))} />
            </>
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
            <SiBriefing target={target} />
            <RegimeMap bundle={bundle} target={target} highlight={highlight} />
            <NasaContext target={target} />
            {/* The 1 g screening question is about NASA-STD-6001 flammability, so the card shows on Flammability only. */}
            {verdict && target.pillar === "flammability" && <VerdictCard verdict={verdict} />}
            <section aria-label="Ranked NASA records" className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold capitalize text-slate-100">{target.pillar} matches</h2>
              {activeCards.length === 0 && (
                <p className="text-sm text-slate-400">No {target.pillar} investigation in the PSI data is available to match.</p>
              )}
              {activeCards.map((s, i) => (
                <ResultCard key={s.record.id} scored={s} rank={ranked.indexOf(s) + 1} next={activeCards[i + 1] ?? null} target={target} />
              ))}
              {otherCards.length > 0 && (
                <>
                  <h2 className="mt-4 text-lg font-semibold text-slate-100">Other pillars (supporting evidence)</h2>
                  {otherCards.map((s, i) => (
                    <ResultCard
                      key={s.record.id}
                      scored={s}
                      rank={ranked.indexOf(s) + 1}
                      next={otherCards[i + 1] ?? null}
                      target={target}
                    />
                  ))}
                </>
              )}
            </section>
            </>
          )}
          <ValidationPanel
            bundle={bundle}
            onOpen={(t) => {
              setTarget(t);
              window.scrollTo({ top: 0 });
            }}
          />
          <Method bundle={bundle} />
        </>
      )}
    </main>
  );
}
