"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_CHECKLIST_OPTIONS,
  type DashboardCategoryId,
} from "@/lib/kraken-dashboard-filters";

export type KrakenCategoryFilterProps = {
  selected: readonly DashboardCategoryId[];
  onChange: (next: DashboardCategoryId[]) => void;
  className?: string;
};

export function KrakenCategoryFilter({ selected, onChange, className }: KrakenCategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selected);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (category: DashboardCategoryId) => {
    const next = new Set(selected);
    if (next.has(category)) next.delete(category);
    else next.add(category);
    onChange(CATEGORY_CHECKLIST_OPTIONS.filter((c) => next.has(c)));
  };

  const selectAll = () => onChange([...CATEGORY_CHECKLIST_OPTIONS]);
  const clearAll = () => onChange([]);

  const label =
    selected.length === 0
      ? "CATEGORIES (none)"
      : selected.length === CATEGORY_CHECKLIST_OPTIONS.length
        ? "ALL CATEGORIES"
        : `CATEGORIES (${selected.length})`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-9 items-center gap-2 border border-border bg-background px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground/40 focus:outline-none"
      >
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-full z-30 mt-1 max-h-[min(320px,50vh)] min-w-[220px] overflow-y-auto border border-border bg-background shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Filter
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="flex flex-col">
            {CATEGORY_CHECKLIST_OPTIONS.map((category) => {
              const checked = selectedSet.has(category);
              return (
                <li key={category}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors",
                      checked
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(category)}
                      className="size-3 shrink-0 accent-foreground"
                    />
                    {category}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
