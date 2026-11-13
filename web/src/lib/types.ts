// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Types for the PyroVector data bundle (built by scripts/build_app_data.py).

export type Status =
  | "recorded"
  | "approx"
  | "range"
  | "levels"
  | "footnote"
  | "not_recorded"
  | "unparsed"
  | "suspect";

export interface Condition {
  min: number | null;
  max: number | null;
  levels: number[];
  status: Status;
  raw: string;
  col: string;
}

export type Pillar = "flammability" | "suppression" | "detection" | "fundamentals";
export type Phase = "solid" | "liquid" | "gas" | "surrogate";

export interface Outcome {
  category: "extinguished" | "disruption" | "other" | "cool_flame" | "self_extinguished" | "flow_terminated" | null;
  fields: Record<string, string>;
}

export interface PsiRecord {
  id: string;
  inv: string;
  table: string;
  row: number;
  ref: string;
  material: string;
  materialNote: string;
  materialKeys: string[];
  orientation: string;
  gravity: string;
  burnTimeS: number | null;
  o2: Condition;
  pressure: Condition;
  flow: Condition;
  thickness: Condition;
  outcome: Outcome | null;
}

export interface Investigation {
  id: string;
  acronym: string;
  title: string;
  doi: string;
  doiUrl: string;
  portalUrl: string;
  projectType: string;
  platform: string;
  hardware: string;
  start: string;
  end: string;
  objective: string;
  approach: string;
  impacts: string;
  pillar: Pillar;
  scale: "full" | "chamber";
  phase: Phase;
  recordsNotTests: boolean;
  /** NASA's planned condition envelope rather than executed tests: context only, never ranked. */
  plannedEnvelope: boolean;
  nRecords: number;
  publications: string[];
}

export interface Bundle {
  builtOn: string;
  source: string;
  investigations: Investigation[];
  records: PsiRecord[];
}

export type Gravity = 0 | 0.16 | 0.38 | 1;
export type FlowDirection = "opposed" | "concurrent" | "coflow" | "quiescent";

export interface Target {
  o2Pct: number;
  pressureKPa: number;
  flowCmS: number;
  flowDirection: FlowDirection;
  materialKey: string;
  thicknessMm: number | null;
  gravity: Gravity;
  pillar: Exclude<Pillar, "fundamentals">;
}
