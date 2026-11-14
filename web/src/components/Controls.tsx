"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Controls panel (BUILD_PLAN A2). Stateless: the target lives in FlameBound.
// Each control states its role, per the Codex-review amendments: nothing may imply
// it changes the ranking when it doesn't.

import { useId } from "react";
import type { FlowDirection, Gravity, Target } from "@/lib/types";
import { MATERIAL_OPTIONS, PRESETS, kpaToPsia, psiaToKpa, type Preset } from "@/lib/presets";

interface Props {
  target: Target;
  onChange: (next: Target) => void;
}

const FLOW_DIRECTIONS: { value: FlowDirection; label: string }[] = [
  { value: "opposed", label: "Opposed" },
  { value: "concurrent", label: "Concurrent" },
  { value: "coflow", label: "Coflow" },
  { value: "quiescent", label: "Quiescent (no flow)" },
];

const GRAVITIES: { value: Gravity; label: string }[] = [
  { value: 0, label: "0 g (microgravity)" },
  { value: 0.16, label: "0.16 g (Moon)" },
  { value: 0.38, label: "0.38 g (Mars)" },
  { value: 1, label: "1 g (Earth)" },
];

const MATERIAL_GROUPS = ["Solids", "Liquids", "Gases"] as const;

// Highlight tolerance only (DEFAULT_TARGET stores pressure rounded to 0.1 kPa). Presets themselves set exact values.
const matchesPreset = (t: Target, p: Preset) =>
  Math.abs(t.o2Pct - p.o2Pct) < 1e-6 && Math.abs(t.pressureKPa - psiaToKpa(p.psia)) < 0.1;

const FIELD = "w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";
const NOTE = "text-xs text-slate-500";

function Slider(props: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  note?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-200">
          {props.label}
        </label>
        <output htmlFor={id} className="font-mono text-sm text-orange-300">
          {props.display} {props.unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-orange-500"
      />
      {props.note && <p className={NOTE}>{props.note}</p>}
    </div>
  );
}

export default function Controls({ target, onChange }: Props) {
  const flowId = useId();
  const matId = useId();
  const gravId = useId();
  const thickId = useId();
  const set = (patch: Partial<Target>) => onChange({ ...target, ...patch });
  const activePreset = PRESETS.find((p) => matchesPreset(target, p));

  return (
    <section aria-label="Target conditions" className="flex flex-col gap-5 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      {/* Pillar tabs */}
      <div role="tablist" aria-label="Pillar" className="flex flex-wrap gap-2">
        {(["flammability", "suppression", "detection"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={target.pillar === p}
            onClick={() => set({ pillar: p })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              target.pillar === p ? "bg-orange-500 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-200">Mission atmosphere presets</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.source}
              aria-pressed={activePreset?.id === p.id}
              onClick={() => set({ o2Pct: p.o2Pct, pressureKPa: psiaToKpa(p.psia) })}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                activePreset?.id === p.id
                  ? "border-orange-500 bg-orange-500/15 text-orange-200"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className={NOTE}>
          {activePreset ? `Source: ${activePreset.source}` : "Custom atmosphere. Presets set O₂ and pressure only."}
        </p>
      </div>

      {/* Sliders */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Slider
          label="Oxygen (O₂)"
          unit="%"
          value={target.o2Pct}
          min={10}
          max={100}
          step={0.5}
          display={target.o2Pct.toFixed(1)}
          note={`O₂ partial pressure ${((target.o2Pct / 100) * target.pressureKPa).toFixed(1)} kPa (O₂% × pressure; context, not scored)`}
          onChange={(v) => set({ o2Pct: v })}
        />
        <Slider
          label="Pressure"
          unit="kPa"
          value={target.pressureKPa}
          min={20}
          max={320}
          step={0.5}
          display={target.pressureKPa.toFixed(1)}
          note={`${kpaToPsia(target.pressureKPa).toFixed(1)} psia`}
          onChange={(v) => set({ pressureKPa: v })}
        />
        <Slider
          label="Airflow"
          unit="cm/s"
          value={target.flowCmS}
          min={0}
          max={50}
          step={0.5}
          display={target.flowCmS.toFixed(1)}
          onChange={(v) => set({ flowCmS: v })}
        />
      </div>

      {/* Selects and thickness */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={matId} className="text-sm font-medium text-slate-200">
            Material or fuel
          </label>
          <select id={matId} className={FIELD} value={target.materialKey} onChange={(e) => set({ materialKey: e.target.value })}>
            {MATERIAL_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {MATERIAL_OPTIONS.filter((m) => m.group === g).map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={flowId} className="text-sm font-medium text-slate-200">
            Flow direction
          </label>
          <select
            id={flowId}
            className={FIELD}
            value={target.flowDirection}
            onChange={(e) => set({ flowDirection: e.target.value as FlowDirection })}
          >
            {FLOW_DIRECTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <p className={NOTE}>Shown for comparison, not used in BCMS.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={gravId} className="text-sm font-medium text-slate-200">
            Gravity
          </label>
          <select
            id={gravId}
            className={FIELD}
            value={target.gravity}
            onChange={(e) => set({ gravity: Number(e.target.value) as Gravity })}
          >
            {GRAVITIES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <p className={NOTE}>Drives the hazard warning only, not the ranking.</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={thickId} className="text-sm font-medium text-slate-200">
            Thickness (optional, mm)
          </label>
          <input
            id={thickId}
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            className={FIELD}
            placeholder="not set"
            value={target.thicknessMm ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const n = Number(raw);
              set({ thicknessMm: raw === "" || !Number.isFinite(n) || n < 0 ? null : n });
            }}
          />
          <p className={NOTE}>Shown for comparison, not used in BCMS.</p>
        </div>
      </div>
    </section>
  );
}
