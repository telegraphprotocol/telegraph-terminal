"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/60 px-3 text-xs font-medium text-foreground hover:bg-muted/80"
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[min(320px,50vh)] min-w-[220px] overflow-y-auto rounded-lg border border-border/50 bg-card p-2 shadow-xl custom-scrollbar"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/40 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Filter categories
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <ul className="flex flex-col gap-0.5">
            {CATEGORY_CHECKLIST_OPTIONS.map((category) => {
              const checked = selectedSet.has(category);
              return (
                <li key={category}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                      checked
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(category)}
                      className="size-3.5 shrink-0 rounded border-border/60 accent-primary"
                    />
                    <span className="font-medium tracking-wide">{category}</span>
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
