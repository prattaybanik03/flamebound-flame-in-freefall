// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Hand-labelled evaluation questions for "Ask NASA's records". The expected sources were labelled by
// reading NASA's investigation records; any one of them counts as a correct source. These questions were
// also used while tuning the retriever, so the scores are a development check, not a held-out benchmark.
export interface EvalQuestion { q: string; expect: string[] }

export const EVAL_QUESTIONS: EvalQuestion[] = [
  { q: "Which fire suppressants did NASA test in microgravity?", expect: ["FLEX"] },
  { q: "Is the 1 g upward-burning screening test conservative for flammability in space?", expect: ["BASS-II", "BASS"] },
  { q: "How rapidly does a large fire grow in low gravity?", expect: ["SAFFIRE-I", "SAFFIRE-II", "SAFFIRE-III"] },
  { q: "What did NASA measure about smoke particle sizes in microgravity?", expect: ["SAME", "SAME-R"] },
  { q: "Which experiments studied cool flames?", expect: ["CFI", "ACME CFI-G", "PSI-117", "PSI-142"] },
  { q: "How does an electric field affect a flame?", expect: ["ACME E-FIELD Flames"] },
  { q: "What is the burning rate emulator used for?", expect: ["ACME BRE"] },
  { q: "How do interacting fuel droplets in an array burn and extinguish?", expect: ["FLEX-2"] },
  { q: "Which investigation studied flame liftoff in coflow jets?", expect: ["SLICE"] },
  { q: "Which NASA results could help model wildfires on Earth?", expect: ["BASS-II"] },
  { q: "What is the smoke point of a coflow flame?", expect: ["SPICE", "PSI-60"] },
  { q: "Which experiments looked at soot in spherical diffusion flames?", expect: ["ACME s-Flame", "ACME/Flame Design"] },
];
