// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// BM25 retrieval over NASA's investigation text (passages.json). Deterministic and dependency-free:
// the same question always retrieves the same passages, and tests can measure it.

export interface Passage {
  id: string;
  psi: string;
  acronym: string;
  title: string;
  doi: string;
  field: string;
  text: string;
}

const STOP = new Set(
  ("a an and are as at be been but by can could did do does for from had has have how i if in into is it its of on or " +
    "so such than that the their them then there these they this to was we were what when where which while who why will with " +
    "would you your about any being nasa's nasa experiment experiments investigation investigations study studied studies research test tested tests")
    .split(" "),
);

/** Domain synonyms so plain-language questions reach NASA's wording. */
const SYNONYMS: Record<string, string[]> = {
  microgravity: ["low", "gravity", "space", "orbit"],
  space: ["microgravity", "spacecraft"],
  suppressant: ["suppression", "extinguish", "extinguishment", "inert"],
  suppression: ["suppressant", "extinguish", "extinguishment"],
  extinguish: ["extinguishment", "extinction", "suppression"],
  smoke: ["particulate", "particle", "detector", "aerosol"],
  detector: ["detection", "smoke"],
  fire: ["flame", "combustion", "burning"],
  flammability: ["flammable", "burn", "burning", "ignition"],
  spread: ["growth", "grow"],
  grow: ["growth", "spread"],
  soot: ["sooting", "smoke"],
  droplet: ["droplets", "fuel"],
  wildfire: ["wildfires", "fire"],
  earth: ["terrestrial", "ground", "normal", "gravity"],
  electric: ["field", "e-field"],
};

export function stem(w: string): string {
  if (w.length <= 4) return w;
  if (w.endsWith("ies") && w.length > 5) return w.slice(0, -3) + "y";
  // "-es" only after s, x, z, ch, sh (gases, fluxes); otherwise just the plural "s" (flames -> flame).
  if (/(s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  for (const suf of ["ations", "ation", "ings", "ing", "ed", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 4 && !(suf === "s" && w.endsWith("ss"))) return w.slice(0, -suf.length);
  }
  return w;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [])
    .flatMap((t) => (t.includes("-") ? [t, ...t.split("-")] : [t]))
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

export interface Index {
  passages: Passage[];
  docs: Map<string, number>[];
  lens: number[];
  avgLen: number;
  df: Map<string, number>;
}

export function buildIndex(passages: Passage[]): Index {
  const docs = passages.map((p) => {
    const tf = new Map<string, number>();
    // Investigation name and field are part of the document, so "SAFFIRE" or "hypothesis" can match.
    for (const t of tokenize(`${p.acronym} ${p.title} ${p.field} ${p.text}`)) tf.set(t, (tf.get(t) ?? 0) + 1);
    return tf;
  });
  const lens = docs.map((d) => [...d.values()].reduce((a, b) => a + b, 0));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  return { passages, docs, lens, avgLen: lens.reduce((a, b) => a + b, 0) / Math.max(1, lens.length), df };
}

function expand(question: string): Map<string, number> {
  const q = new Map<string, number>();
  for (const t of tokenize(question)) {
    q.set(t, Math.max(q.get(t) ?? 0, 1));
    for (const s of SYNONYMS[t] ?? []) for (const st of tokenize(s)) q.set(st, Math.max(q.get(st) ?? 0, 0.4));
  }
  return q;
}

export interface Hit { passage: Passage; score: number }

/** Top-k passages by BM25 (k1 1.5, b 0.75). Synonyms count at 0.4 weight. */
export function retrieve(index: Index, question: string, k = 8): Hit[] {
  const q = expand(question);
  const N = index.passages.length;
  const scores = index.docs.map((tf, i) => {
    let s = 0;
    for (const [t, w] of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += w * idf * ((f * 2.5) / (f + 1.5 * (1 - 0.75 + (0.75 * index.lens[i]) / index.avgLen)));
    }
    return s;
  });
  return scores
    .map((score, i) => ({ passage: index.passages[i], score }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
