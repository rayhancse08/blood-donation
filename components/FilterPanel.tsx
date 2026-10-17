"use client";

import { useState, type ReactNode } from "react";
import { buttonClass, cn } from "./ui";

/** Collapses a filter form behind a toggle on phones; always expanded from `sm` up. */
export function FilterPanel({ children, activeCount = 0 }: { children: ReactNode; activeCount?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(buttonClass.secondary, "w-full justify-between sm:hidden")}
      >
        <span>
          Filters
          {activeCount > 0 && <span className="ml-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{activeCount}</span>}
        </span>
        <svg viewBox="0 0 20 20" className={cn("h-4 w-4 transition-transform", open && "rotate-180")} fill="currentColor" aria-hidden>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
      <div className={cn(open ? "mt-3 block" : "hidden", "sm:mt-0 sm:block")}>{children}</div>
    </div>
  );
}
