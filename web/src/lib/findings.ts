// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// NASA's own words on 1 g screening versus microgravity, quoted verbatim from the PSI investigation
// records (data/investigations.json). tests/findings.test.ts checks every quote character for character,
// so the app can never paraphrase or misquote NASA here. Generated from the data; do not edit by hand.

export interface Finding {
  id: string;
  psi: string;
  acronym: string;
  title: string;
  /** PSI record field the quote comes from. */
  field: "hypothesis" | "research_impacts" | "objective" | "approach";
  fieldLabel: string;
  quote: string;
  doi: string;
  pillar: "flammability" | "suppression" | "detection";
}

export const FINDINGS: Finding[] = [
  {
    "id": "bass-selection",
    "psi": "PSI-26",
    "acronym": "BASS",
    "title": "Burning and Suppression of Solids",
    "field": "research_impacts",
    "quote": "Current NASA spacecraft materials selection is based on a standard test method (NASA–STD–6001 Test 1) that segregates material based on 1-g behavior without consideration of low gravity effects.",
    "doi": "10.60555/58h4-dy80",
    "pillar": "flammability",
    "fieldLabel": "research impacts"
  },
  {
    "id": "bass2-conservative",
    "psi": "PSI-25",
    "acronym": "BASS-II",
    "title": "Burning and Suppression of Solids - II",
    "field": "hypothesis",
    "quote": "NASA tests and controls materials from a flammability perspective using an upward burning test in normal gravity, which is considered to be the worst-case geometry for flammability of the material on Earth. However, it may not be conservative for flammability in space.",
    "doi": "10.60555/4qc4-de67",
    "pillar": "flammability",
    "fieldLabel": "hypothesis"
  },
  {
    "id": "bass2-hypothesis",
    "psi": "PSI-25",
    "acronym": "BASS-II",
    "title": "Burning and Suppression of Solids - II",
    "field": "hypothesis",
    "quote": "BASS–II tests the hypothesis that materials in microgravity, with adequate ventilation, burn as well if not better than the same material in normal gravity with other conditions being identical (pressure, O2 concentration, temperature, etc.).",
    "doi": "10.60555/4qc4-de67",
    "pillar": "flammability",
    "fieldLabel": "hypothesis"
  },
  {
    "id": "saffire2-limits",
    "psi": "PSI-99",
    "acronym": "SAFFIRE-II",
    "title": "Spacecraft Fire Experiment-II",
    "field": "objective",
    "quote": "The objectives of SAFFIRE-II are to determine how rapidly a large scale fire grows in low-gravity and to investigate the low-g flammability limits compared to those obtained in NASA’s normal gravity material flammability screening test.",
    "doi": "10.60555/2chp-m469",
    "pillar": "flammability",
    "fieldLabel": "objective"
  },
  {
    "id": "flex-buoyancy",
    "psi": "PSI-69",
    "acronym": "FLEX",
    "title": "Flame Extinguishment Experiment",
    "field": "hypothesis",
    "quote": "Specifically, the hypothesis posits that the lack of buoyant convection in microgravity will lead to significant differences in the flammability limits and suppression efficacy of various fire suppressant agents compared to normal gravity conditions.",
    "doi": "10.60555/mbq8-0451",
    "pillar": "suppression",
    "fieldLabel": "hypothesis"
  },
  {
    "id": "flex-loi",
    "psi": "PSI-69",
    "acronym": "FLEX",
    "title": "Flame Extinguishment Experiment",
    "field": "approach",
    "quote": "A primary objective of the experiments is to determine the Limiting Oxygen Index (LOI) as a function of ambient pressure and determine how the presence of a suppressant influences the LOI .",
    "doi": "10.60555/mbq8-0451",
    "pillar": "suppression",
    "fieldLabel": "approach"
  },
  {
    "id": "same-detector",
    "psi": "PSI-102",
    "acronym": "SAME",
    "title": "Smoke and Aerosol Measurement Experiment",
    "field": "research_impacts",
    "fieldLabel": "research impacts",
    "quote": "The SAME experiment will provide technology for an advanced fire detector for future spacecraft that will be used for long duration missions. SAME will provide quantitative data on the sensitivity of these detectors to reduced gravity smokes that will allow evaluation of the adequacy of these existing technologies using relevant data.",
    "doi": "10.60555/gd4k-8h62",
    "pillar": "detection"
  },
  {
    "id": "same-objective",
    "psi": "PSI-102",
    "acronym": "SAME",
    "title": "Smoke and Aerosol Measurement Experiment",
    "field": "objective",
    "fieldLabel": "objective",
    "quote": "One of the major goals of this investigation was to quantify the sizes that the liquid smoke particulate achieves in low gravity and to relate the droplet size distribution to the smoke generation and smoke transport conditions in the experiment.",
    "doi": "10.60555/gd4k-8h62",
    "pillar": "detection"
  }
];

export const findingsFor = (pillar: string): Finding[] => FINDINGS.filter((f) => f.pillar === pillar);
