// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Roadmap: what exists today and what a funded team could add. No figures, dates or market claims.

const BUILT: ReadonlyArray<readonly [string, string]> = [
  ["Scenario matching", "Finds the closest NASA experiments to your cabin, each linked to its source."],
  ["Evidence Gap Atlas", "Shows which atmospheres and materials NASA's data covers, and which it doesn't."],
  ["Materials checker", "Checks a list of materials against the records, in your browser."],
  ["Checked Q&A", "AI answers about NASA's records pass automated citation and number checks before they are shown."],
];

const FUNDED: ReadonlyArray<{ title: string; unlocks: string; needs: string }> = [
  {
    title: "Evidence dossier",
    unlocks: "A fuller cited report that a safety review can use, beyond today's evidence report.",
    needs: "Review of the report format with working fire-safety engineers.",
  },
  {
    title: "More data",
    unlocks: "Fewer gaps in the Atlas.",
    needs: "Access to experiment data from ESA, JAXA, drop towers and parabolic flights.",
  },
  {
    title: "Partial gravity",
    unlocks: "Checks for Moon gravity (0.16 g) and Mars gravity (0.38 g).",
    needs: "NASA releasing partial-gravity data, as it becomes available.",
  },
  {
    title: "Test planning",
    unlocks: "A ranked list of the untested conditions most worth flying.",
    needs: "Input from NASA researchers on what makes a test worth running.",
  },
  {
    title: "Team workspaces",
    unlocks: "Private materials lists for habitat builders.",
    needs: "Accounts and secure storage, built with a pilot team.",
  },
];

export default function FuturePlans() {
  return (
    <section id="future" aria-labelledby="future-title" className="scroll-mt-16 rounded-lg border border-slate-800 bg-slate-900/50 p-5">
      <h2 id="future-title" className="text-2xl text-slate-50">Future plans</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        FlameBound is a working prototype built on NASA&apos;s open data. These are directions a funded team could take. None of
        them is built yet.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h3 className="text-lg text-slate-100">Built today</h3>
          <ul className="mt-3 divide-y divide-slate-800 border-y border-slate-800">
            {BUILT.map(([t, d]) => (
              <li key={t} className="py-3">
                <p className="text-slate-100">{t}</p>
                <p className="mt-1 text-sm text-slate-300">{d}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg text-slate-100">With proper development funding</h3>

          <div className="mt-3 rounded-md border-l-4 border-l-orange-400 bg-slate-900/80 p-4">
            <p className="font-display text-2xl leading-tight text-slate-50">Beyond space: fire safety on Earth</p>
            <p className="mt-2 text-sm text-slate-200">
              Aircraft cabins and oxygen-rich hospital rooms face a similar question: do the available fire tests match the
              real conditions? The same matching engine could compare fire-test data from those settings with real-world
              conditions.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              <span className="text-slate-100">Needs:</span> fire-test datasets from aircraft and healthcare settings, and
              fire-safety specialists to check the matching. So far the engine has only been tried on NASA&apos;s microgravity data.
            </p>
          </div>

          <ul className="mt-3 divide-y divide-slate-800 border-y border-slate-800">
            {FUNDED.map((f) => (
              <li key={f.title} className="py-3">
                <p className="text-slate-100">{f.title}</p>
                <p className="mt-1 text-sm text-slate-300"><span className="text-slate-100">Unlocks:</span> {f.unlocks}</p>
                <p className="mt-1 text-sm text-slate-300"><span className="text-slate-100">Needs:</span> {f.needs}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-5 max-w-2xl text-sm text-slate-300">
        FlameBound does not assess whether a material is safe; that stays with fire-safety specialists.
      </p>
    </section>
  );
}
