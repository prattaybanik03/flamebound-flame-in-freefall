"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Regime map with axes per pillar (locked Sat 10:47). Real points only:
//   flammability: O2 (%) vs airflow (cm/s); records without airflow sit in a side strip.
//   suppression: O2 (%) vs pressure (kPa), coloured by NASA's recorded outcome.
import { useMemo, useState } from "react";
import type { Bundle, Investigation, PsiRecord, Target, Condition } from "@/lib/types";

const USABLE = new Set(["recorded", "approx", "range", "levels", "footnote"]);
const mid = (c: Condition): number | null => {
  if (!USABLE.has(c.status)) return null;
  if (c.levels.length) return null; // discrete levels are not plotted as a single point
  if (c.min === null || c.max === null) return null;
  return (c.min + c.max) / 2;
};

const OUTCOME_COLOR: Record<string, string> = {
  extinguished: "#38bdf8",
  disruption: "#f97316",
  self_extinguished: "#a78bfa",
  flow_terminated: "#94a3b8",
  cool_flame: "#22d3ee",
};
const OUTCOME_LABEL: Record<string, string> = {
  extinguished: "Extinguished (FLEX)",
  disruption: "Droplet disruption (FLEX)",
  self_extinguished: "Self-extinguished (CFI-G)",
  flow_terminated: "Flow terminated (CFI-G)",
  cool_flame: "Cool flame (CFI-G)",
};
const INV_COLOR = ["#f59e0b", "#ef4444", "#10b981", "#eab308", "#ec4899", "#6366f1"];

interface Pt { r: PsiRecord; inv: Investigation; x: number | null; y: number; color: string; label: string }

export default function RegimeMap({
  bundle, target, highlight,
}: { bundle: Bundle; target: Target; highlight: Set<string> }) {
  const [hover, setHover] = useState<Pt | null>(null);
  const byId = useMemo(() => new Map(bundle.investigations.map((i) => [i.id, i])), [bundle]);
  const flam = target.pillar === "flammability";

  const { pts, legend } = useMemo(() => {
    const pts: Pt[] = [];
    const legend = new Map<string, string>();
    const invColor = new Map<string, string>();
    for (const r of bundle.records) {
      const inv = byId.get(r.inv)!;
      if (inv.pillar !== target.pillar || inv.plannedEnvelope) continue;
      const y = mid(r.o2);
      if (y === null) continue;
      if (flam) {
        if (!invColor.has(inv.id)) invColor.set(inv.id, INV_COLOR[invColor.size % INV_COLOR.length]);
        const color = invColor.get(inv.id)!;
        legend.set(inv.acronym, color);
        pts.push({ r, inv, x: mid(r.flow), y, color, label: inv.acronym });
      } else {
        const x = mid(r.pressure);
        if (x === null) continue;
        const cat = r.outcome?.category ?? "";
        const color = OUTCOME_COLOR[cat] ?? "#64748b";
        legend.set(OUTCOME_LABEL[cat] ?? "Outcome not recorded", color);
        pts.push({ r, inv, x, y, color, label: inv.acronym });
      }
    }
    return { pts, legend };
  }, [bundle, byId, target.pillar, flam]);

  // Geometry
  const W = 640, H = 340, L = flam ? 104 : 48, R = 16, T = 16, B = 40;
  const xMax = flam ? 50 : Math.max(320, target.pressureKPa * 1.1);
  const yMin = 10, yMax = Math.max(45, Math.min(100, target.o2Pct + 5));
  const X = (v: number) => L + (Math.min(v, xMax) / xMax) * (W - L - R);
  const Y = (v: number) => T + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (H - T - B);
  const xTicks = flam ? [0, 10, 20, 30, 40, 50] : [0, 50, 100, 150, 200, 250, 300];
  const yTicks = [10, 20, 30, 40, ...(yMax > 60 ? [60, 80, 100] : [])].filter((v) => v <= yMax);
  const tx = flam ? target.flowCmS : target.pressureKPa;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-100">
          {flam ? "Flammability regime: O₂ vs cabin airflow" : "Suppression regime: O₂ vs pressure"}
        </h3>
        <span className="text-xs text-slate-400">Every point is a NASA PSI record · crosshair = your cabin</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={flam ? "Oxygen versus airflow for NASA flammability records" : "Oxygen versus pressure for NASA suppression records"}>
        {flam && (
          <g>
            <rect x={8} y={T} width={L - 24} height={H - T - B} rx={6} fill="#0f172a" stroke="#1e293b" />
            <text x={(L - 16) / 2 + 4} y={H - B + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">airflow</text>
            <text x={(L - 16) / 2 + 4} y={H - B + 26} textAnchor="middle" fontSize={10} fill="#94a3b8">not in cm/s</text>
          </g>
        )}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="#1e293b" />
            <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">{v}%</text>
          </g>
        ))}
        {xTicks.filter((v) => v <= xMax).map((v) => (
          <g key={`x${v}`}>
            <line x1={X(v)} x2={X(v)} y1={T} y2={H - B} stroke="#1e293b" />
            <text x={X(v)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">{v}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#cbd5e1">
          {flam ? "Airflow (cm/s)" : "Pressure (kPa)"}
        </text>
        {pts.map((p) => {
          const hl = highlight.has(p.r.id);
          const cx = p.x === null ? 10 + ((p.r.row * 37) % (L - 36)) : X(p.x);
          return (
            <circle key={p.r.id} cx={cx} cy={Y(p.y)} r={hl ? 6 : 3.2}
              fill={p.color} fillOpacity={hl ? 1 : 0.55} stroke={hl ? "#fff" : "none"} strokeWidth={1.5}
              onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} />
          );
        })}
        {/* target crosshair */}
        <g pointerEvents="none">
          <line x1={X(tx)} x2={X(tx)} y1={T} y2={H - B} stroke="#f43f5e" strokeDasharray="4 4" />
          <line x1={L} x2={W - R} y1={Y(target.o2Pct)} y2={Y(target.o2Pct)} stroke="#f43f5e" strokeDasharray="4 4" />
          <circle cx={X(tx)} cy={Y(target.o2Pct)} r={7} fill="none" stroke="#f43f5e" strokeWidth={2} />
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        {[...legend.entries()].map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k}</span>
        ))}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-rose-500" />Your cabin</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-white bg-slate-400" />Top-ranked records</span>
      </div>
      <p className="mt-2 min-h-[2.5rem] text-xs text-slate-400">
        {hover
          ? `${hover.inv.acronym} · ${hover.r.ref || "row " + hover.r.row} · ${hover.r.material || "material not recorded"} · O₂ ${hover.r.o2.raw} (${hover.r.o2.col})` +
            (flam ? ` · airflow ${hover.r.flow.raw || "not recorded in cm/s"}` : ` · pressure ${hover.r.pressure.raw} (${hover.r.pressure.col})`) +
            (hover.r.outcome?.category ? ` · outcome: ${OUTCOME_LABEL[hover.r.outcome.category] ?? hover.r.outcome.category}` : "")
          : flam
            ? "Hover a point for its NASA record. Records whose airflow NASA logged only as fan settings (BASS-II) sit in the left strip, placed by O₂ only."
            : "Hover a point for its NASA record. Colours are NASA's recorded test outcome."}
      </p>
    </div>
  );
}
