"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Sticky top navigation: each label jumps down the same page; the current section is highlighted.
import { useEffect, useState } from "react";

export const SECTIONS = [
  { id: "start", label: "Start" },
  { id: "scenario", label: "Explore" },
  { id: "materials", label: "Check materials" },
  { id: "atlas", label: "Evidence gaps" },
  { id: "ask", label: "Ask NASA" },
  { id: "future", label: "Future" },
  { id: "validation", label: "How it was checked" },
] as const;

// A section is "current" once its top has passed this line (below the sticky bar).
const LINE = 140;

export default function SectionNav({ ready }: { ready: boolean }) {
  const [active, setActive] = useState<string>("start");
  // Below the lg breakpoint the links collapse into a "Jump to" menu, so nobody has to find a sideways scroll.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const activeLabel = SECTIONS.find((s) => s.id === active)?.label ?? "Start";

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current: string = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= LINE) current = s.id;
      }
      if (atBottom && document.getElementById(SECTIONS[SECTIONS.length - 1].id)) current = SECTIONS[SECTIONS.length - 1].id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ready]);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>
      <nav aria-label="Sections" className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="#start" className="flex shrink-0 items-center gap-2 py-2.5 text-slate-50" aria-label="FlameBound, back to the start">
            <span className="ug-flame ug-flame-sm" aria-hidden="true" />
            <span className="font-display hidden text-xl leading-none sm:inline">FlameBound</span>
          </a>
          <ul className="hidden min-w-0 flex-1 gap-1 py-1.5 lg:flex">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    aria-current={on ? "location" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm whitespace-nowrap ${
                      on ? "bg-slate-800 text-orange-200" : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
                    }`}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="section-menu"
            onClick={() => setOpen((o) => !o)}
            className="ml-auto flex min-w-0 items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:border-orange-400 lg:hidden"
          >
            <span className="text-slate-400">Jump to</span>
            <span className="truncate">{activeLabel}</span>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
              <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {open && (
          <ul id="section-menu" className="absolute inset-x-0 top-full border-b border-slate-800 bg-slate-950 px-4 py-2 shadow-lg shadow-black/50 sm:px-6 lg:hidden">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={() => setOpen(false)}
                    aria-current={on ? "location" : undefined}
                    className={`block rounded-md px-3 py-3 text-base ${on ? "bg-slate-800 text-orange-200" : "text-slate-200 hover:bg-slate-900"}`}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </>
  );
}
