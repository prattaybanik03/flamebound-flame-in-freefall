"use client";
// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
// Sticky top navigation: each label jumps down the same page; the current section is highlighted.
import { useEffect, useState } from "react";

export const SECTIONS = [
  { id: "start", label: "Start" },
  { id: "scenario", label: "Explore" },
  { id: "materials", label: "Your materials" },
  { id: "atlas", label: "The gap" },
  { id: "ask", label: "Ask NASA" },
  { id: "future", label: "Future" },
  { id: "validation", label: "How it was checked" },
] as const;

// A section is "current" once its top has passed this line (below the sticky bar).
const LINE = 140;

export default function SectionNav({ ready }: { ready: boolean }) {
  const [active, setActive] = useState<string>("start");

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
          <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-1.5">
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
        </div>
      </nav>
    </>
  );
}
