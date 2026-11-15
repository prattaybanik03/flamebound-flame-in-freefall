// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Plain-English introduction for visitors who are not engineers.
import { HEADLINE } from "@/lib/atlas";

const BTN = "rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:border-orange-400 hover:text-orange-200";

const TERMS: ReadonlyArray<readonly [string, string]> = [
  ["Microgravity", "The near-weightless conditions in orbit, such as on the International Space Station."],
  ["Atmosphere, O₂ %", "The share of the cabin air that is oxygen. Air on Earth is about 21% oxygen."],
  ["kPa (kilopascals)", "A measure of air pressure. Air at sea level is about 101 kPa."],
  ["Airflow", "How fast air moves past the flame, in centimetres per second."],
  ["Match score", "A score from 0 to 100 for how closely an experiment's conditions (oxygen, material, airflow, pressure) match yours."],
  ["PSI", "NASA's Physical Sciences Informatics, the public archive that holds the experiment data."],
  ["Artemis", "NASA's programme to return people to the Moon."],
];

export default function StartSection() {
  return (
    <section id="start" aria-labelledby="start-title" className="flex scroll-mt-16 flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="ug-flame" aria-hidden="true" />
        <h1 id="start-title" className="text-5xl leading-none text-slate-50">FlameBound</h1>
      </div>
      <p className="font-display max-w-2xl text-3xl leading-tight text-slate-100">Fire behaves differently in space.</p>
      <p className="max-w-2xl text-base leading-relaxed text-slate-300">
        Without gravity, hot air doesn&apos;t rise, so flames burn and spread in ways they don&apos;t on Earth. NASA has tested this
        in orbit. FlameBound checks whether those tests cover the air that future Moon bases and
        spacecraft will use, and shows clearly where they don&apos;t.
      </p>

      <ol className="grid max-w-3xl gap-3 text-sm text-slate-300 sm:grid-cols-3">
        {[
          "Choose a cabin atmosphere and a material.",
          "See the NASA experiments that most closely match, and how well they match.",
          "Check a whole list of materials at once, or ask a question about NASA's records.",
        ].map((t, i) => (
          <li key={t} className="flex gap-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
            <span className="font-display text-2xl leading-none text-orange-300" aria-hidden="true">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <a href="#scenario" className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400">Explore a scenario</a>
        <a href="#materials" className={BTN}>Check a materials list</a>
        <a href="#atlas" className={BTN}>See the evidence gaps</a>
      </div>

      <p className="max-w-2xl rounded-md border-l-4 border-l-[#ff5a4f] bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
        <span className="font-display text-base text-slate-50">Finding:</span> In the NASA records FlameBound ingested, today&apos;s ISS
        cabin air has a close test for {HEADLINE.issCovered} of {HEADLINE.issTotal} common materials ({HEADLINE.issExact} on the
        exact material, the rest through a different solid). The Artemis lunar, exploration and EVA atmospheres have one for{" "}
        {HEADLINE.artemisCovered} of {HEADLINE.artemisTotal} material and atmosphere combinations, at each airflow setting. These are
        classifications under FlameBound&apos;s matching rules.{" "}
        <a href="#atlas" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">See the Evidence Gap Atlas</a>
      </p>

      <p className="max-w-2xl text-sm text-slate-400">
        Who this is for: engineers who design spacecraft and habitats, and anyone curious how fire works in space. It shows where
        NASA&apos;s evidence exists. It does not say whether a material is safe.
      </p>

      <details className="max-w-2xl rounded-md border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
        <summary className="cursor-pointer text-slate-100">Words used on this page</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[11rem_1fr]">
          {TERMS.map(([term, def]) => (
            <div key={term} className="contents">
              <dt className="text-slate-100">{term}</dt>
              <dd className="text-slate-300">{def}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
