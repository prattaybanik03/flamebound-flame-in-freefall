// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// NASA's own words on why microgravity matters for this pillar, quoted verbatim from the PSI records.
// Context for the engineer, never a verdict on their cabin.
import { findingsFor } from "@/lib/findings";
import type { Target } from "@/lib/types";

const HEADINGS: Record<string, { title: string; lede: string }> = {
  flammability: {
    title: "What NASA says about 1 g screening",
    lede: "Spacecraft materials are screened with an upward-burning test on Earth. NASA's own flight investigations question whether that is conservative in microgravity:",
  },
  detection: {
    title: "What NASA says about smoke detection in microgravity",
    lede: "Spacecraft smoke detectors were designed with smoke made on Earth. NASA flew SAME and SAME-R to measure smoke made in microgravity:",
  },
  suppression: {
    title: "What NASA says about suppression in microgravity",
    lede: "Suppression limits measured on Earth assume buoyant convection. NASA's flight investigations set out to measure what changes without it:",
  },
};

export default function NasaContext({ target }: { target: Target }) {
  const findings = findingsFor(target.pillar);
  const heading = HEADINGS[target.pillar];
  if (!heading || findings.length === 0) return null;
  return (
    <section aria-label={heading.title} className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 className="text-lg text-slate-100">{heading.title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-400">{heading.lede}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {findings.map((f) => (
          <figure key={f.id} className="flex flex-col justify-between rounded-md border-l-2 border-orange-400 bg-slate-950/50 py-3 pl-4 pr-3">
            <blockquote className="text-sm leading-relaxed text-slate-200">&ldquo;{f.quote}&rdquo;</blockquote>
            <figcaption className="mt-2 text-xs text-slate-400">
              {f.acronym} {f.fieldLabel}, {f.psi},{" "}
              <a
                href={`https://doi.org/${f.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 underline underline-offset-2 hover:text-sky-200"
              >
                DOI {f.doi}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Quoted verbatim from NASA&apos;s PSI investigation records and checked character for character by the test suite. These
        statements frame the question; they are not a conclusion about your cabin.
      </p>
    </section>
  );
}
