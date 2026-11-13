// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Mission atmosphere presets (P2). Sources noted per preset; see agents/DECISIONS.md.
import type { Target } from "./types";

export const PSIA_TO_KPA = 6.894757;
export const kpaToPsia = (kpa: number) => kpa / PSIA_TO_KPA;
export const psiaToKpa = (psia: number) => psia * PSIA_TO_KPA;

export interface Preset {
  id: string;
  label: string;
  psia: number;
  o2Pct: number;
  source: string;
}

export const PRESETS: Preset[] = [
  { id: "iss", label: "ISS / Earth baseline", psia: 14.7, o2Pct: 21, source: "Challenge statement: Earth sea level 14.7 psi, 21% O₂" },
  { id: "lunar", label: "Lunar base / pressurised rover", psia: 10.2, o2Pct: 30, source: "Challenge statement: likely ≥30% O₂ at ≤10.2 psi" },
  { id: "explore", label: "Exploration atmosphere", psia: 8.2, o2Pct: 34, source: "ACME BRE objectives (NASA-considered atmosphere), DOI 10.60555/vb93-3y72" },
  { id: "eva", label: "EVA spacesuit", psia: 4.3, o2Pct: 100, source: "Challenge statement: 100% O₂ at 4.3 psi" },
];

export interface MaterialOption { key: string; label: string; group: "Solids" | "Liquids" | "Gases" }

export const MATERIAL_OPTIONS: MaterialOption[] = [
  { key: "sibal", label: "SIBAL (cotton–fiberglass)", group: "Solids" },
  { key: "pmma", label: "PMMA (acrylic)", group: "Solids" },
  { key: "nomex", label: "Nomex", group: "Solids" },
  { key: "silicone", label: "Silicone", group: "Solids" },
  { key: "kapton", label: "Kapton", group: "Solids" },
  { key: "teflon", label: "Teflon", group: "Solids" },
  { key: "heptane", label: "n-Heptane", group: "Liquids" },
  { key: "methanol", label: "Methanol", group: "Liquids" },
  { key: "dodecane", label: "n-Dodecane", group: "Liquids" },
  { key: "ethylene", label: "Ethylene (C₂H₄)", group: "Gases" },
  { key: "methane", label: "Methane (CH₄)", group: "Gases" },
  { key: "propane", label: "Propane", group: "Gases" },
];

export const DEFAULT_TARGET: Target = {
  o2Pct: 21,
  pressureKPa: Math.round(psiaToKpa(14.7) * 10) / 10,
  flowCmS: 20,
  flowDirection: "concurrent",
  materialKey: "sibal",
  thicknessMm: null,
  gravity: 0,
  pillar: "flammability",
};
