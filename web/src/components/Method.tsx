// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Method and limits footer (BUILD_PLAN A7). Weights and constants are imported from the
// engine, so this text cannot drift from the score that is actually computed.
import { MATERIAL_SCORES, PILLAR_SCORES, REFUSAL_THRESHOLD, SCALES, WEIGHTS } from "@/lib/bcms";
import type { Bundle } from "@/lib/types";

const pct = (w: number) => `${Math.round(w * 100)}%`;
const H = "text-sm font-semibold text-slate-200";
const P = "mt-1 text-xs leading-relaxed text-slate-400";
const CODE = "rounded bg-slate-800 px-1 py-0.5 font-mono text-[11px] text-slate-200";

const STATUSES: [string, string][] = [
  ["recorded", "NASA's cell gives a single value."],
  ["approx", "NASA wrote an approximate value (e.g. ~21.5); used as given."],
  ["range", "NASA gave a range; distance is 0 inside it, otherwise to the nearest edge."],
  ["levels", "NASA listed discrete levels; distance is to the nearest listed level, never the span between them."],
  ["footnote", "Value comes from a note printed with NASA's table."],
  ["not_recorded", "NASA's table has no such column. Never guessed; contributes 0."],
  ["unparsed", "The cell could not be read as a number. Contributes 0; raw text kept."],
  ["suspect", "Physically implausible source value. Withheld, contributes 0; raw text kept."],
];

export default function Method({ bundle }: { bundle: Bundle }) {
  return (
    <footer aria-label="Method and limits" className="mt-6 grid gap-6 border-t border-slate-800 pt-6 md:grid-cols-2">
      <section>
        <h2 className={H}>How BCMS is calculated</h2>
        <p className={P}>
          The Boundary Condition Match Score (0 to 100) measures how closely a NASA record&apos;s conditions match yours. It
          does not measure fire safety.
        </p>
        <p className={`${P} font-mono text-slate-300`}>BCMS = 100 × Σ (weight × sub-score), over dimensions NASA recorded</p>
        <ul className={`${P} list-disc space-y-0.5 pl-5`}>
          <li>
            O₂ {pct(WEIGHTS.o2)}: <span className={CODE}>exp(−|ΔO₂| / {SCALES.o2})</span>, Δ in % points
          </li>
          <li>
            Material {pct(WEIGHTS.material)}: exact {MATERIAL_SCORES.exact}, calibrated surrogate {MATERIAL_SCORES.surrogate}, same
            fuel phase {MATERIAL_SCORES.samePhase}, other {MATERIAL_SCORES.other} (provisional)
          </li>
          <li>
            Airflow {pct(WEIGHTS.flow)}: <span className={CODE}>exp(−|ΔV| / {SCALES.flow})</span>, Δ in cm/s
          </li>
          <li>
            Pressure {pct(WEIGHTS.pressure)}: <span className={CODE}>exp(−|ΔP| / {SCALES.pressure})</span>, Δ in kPa
          </li>
          <li>
            Pillar &amp; scale {pct(WEIGHTS.pillar)}: same pillar full-scale {PILLAR_SCORES.fullScale}, same pillar chamber{" "}
            {PILLAR_SCORES.chamber}, other pillar {PILLAR_SCORES.mismatch} (provisional)
          </li>
        </ul>
        <p className={P}>
          A dimension NASA did not record contributes 0: no re-weighting, no guessing. Each investigation is represented by
          its best-matching record. Thickness and flow direction are shown for comparison and are not scored. Gravity
          drives the hazard warning only.
        </p>
        <p className={P}>
          An Extrapolation Hazard is shown when the best match in the active pillar is below {REFUSAL_THRESHOLD}% (a
          provisional retrieval threshold, not a validated safety boundary) or when 0.16 g or 0.38 g is selected. No warning
          does not mean safe.
        </p>
      </section>

      <section>
        <h2 className={H}>What each value status means</h2>
        <dl className={`${P} grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5`}>
          {STATUSES.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <span className={CODE}>{k}</span>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <h2 className={`${H} mt-5`}>Known gaps</h2>
        <ul className={`${P} list-disc space-y-0.5 pl-5`}>
          <li>Solid-material flammability tables (BASS, BASS-II, Saffire) do not record pressure, so it scores 0 for them.</li>
          <li>
            PSI has no partial-gravity combustion data. Microgravity results are not lunar or Martian results; NASA&apos;s
            planned LUCI and FM2 experiments target this gap.
          </li>
          <li>Planned test envelopes (FLEX-2) are context only and are never ranked or plotted.</li>
          <li>ACME BRE and FLEX-2 rows are records, not single tests.</li>
          <li>The Detection pillar (SAME / SAME-R smoke data) is not yet included.</li>
        </ul>
      </section>

      <section>
        <h2 className={H}>Data source</h2>
        <p className={P}>
          {bundle.source}. {bundle.investigations.length} combustion investigations, {bundle.records.length.toLocaleString("en-AU")}{" "}
          table records. Data snapshot: {bundle.builtOn}. Each investigation is cited by its DOI, as PSI requests.
        </p>
      </section>

      <section>
        <h2 className={H}>Use of SI</h2>
        <p className={P}>
          The solution concept and product decisions are the team&apos;s own. Code was written with help from Claude
          (Anthropic), and the build plan was reviewed with Codex (OpenAI). SI-assisted source files carry a header
          comment, and the full disclosure is in the project README under &quot;Use of SI&quot;. Rankings and numbers are
          computed deterministically from NASA&apos;s data; no SI model produces them.
        </p>
      </section>
    </footer>
  );
}
