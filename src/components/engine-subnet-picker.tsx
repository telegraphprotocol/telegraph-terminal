"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export type EngineSubnetPickerProps = {
  subnets: Array<{ id: string; label: string }>;
  selectedSubnetId: string | null;
  onSubnetChange: (subnetId: string | null) => void;
  loading?: boolean;
  error?: string | null;
  /** Dropdown alignment under the trigger */
  menuAlign?: "start" | "end";
};

const PANEL_MARGIN = 8;

/** Clamped, viewport-relative geometry so the panel never gets clipped by an
 * ancestor's overflow-hidden or pushed off-screen on narrow/mid-size viewports. */
function computePanelGeometry(rect: DOMRect, align: "start" | "end") {
  const width = Math.min(280, window.innerWidth - PANEL_MARGIN * 2);
  const desiredLeft = align === "end" ? rect.right - width : rect.left;
  const left = Math.max(PANEL_MARGIN, Math.min(desiredLeft, window.innerWidth - width - PANEL_MARGIN));
  return { top: rect.bottom + PANEL_MARGIN, left, width };
}

export function EngineSubnetPicker({
  subnets,
  selectedSubnetId,
  onSubnetChange,
  loading = false,
  error = null,
  menuAlign = "end",
}: EngineSubnetPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geometry, setGeometry] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const engineUnreachable = Boolean(error) && subnets.length === 0 && !loading;
  const isAutoRouting = !selectedSubnetId && !engineUnreachable;

  const primaryLabel = loading
    ? "Loading miners…"
    : selectedSubnetId
      ? subnets.find((s) => s.id === selectedSubnetId)?.label ?? `SN${selectedSubnetId}`
      : engineUnreachable
        ? "Engine offline"
        : "Auto routing";

  function toggle() {
    if (!dropdownOpen && btnRef.current) {
      setGeometry(computePanelGeometry(btnRef.current.getBoundingClientRect(), menuAlign));
    }
    setDropdownOpen((v) => !v);
  }

  return (
    <div className="relative flex min-w-0 flex-col gap-0.5">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn(
          "inline-flex h-8 w-full max-w-full items-center gap-1.5 border px-2.5 sm:px-3 text-left transition-all whitespace-nowrap",
          "lg:w-auto lg:max-w-[min(260px,calc(100vw-14rem))]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
          engineUnreachable
            ? "border-amber-600/50 bg-amber-500/5 hover:bg-amber-500/10 dark:border-amber-500/40"
            : "border-orange-600 bg-orange-500/15 hover:bg-orange-500/20 dark:border-orange-500 shadow-[0_0_14px_rgba(249,115,22,0.18)]",
        )}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        aria-label={`Miner routing: ${primaryLabel}`}
      >
        <span className={cn(
          "min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.1em] leading-tight",
          engineUnreachable ? "text-foreground" : "text-orange-700 dark:text-orange-400",
        )}>
          {primaryLabel}
        </span>
        <ChevronDown
          size={12}
          className={cn("shrink-0 transition-colors", engineUnreachable ? "text-muted-foreground" : "text-orange-700/70 dark:text-orange-400/70")}
          aria-hidden
        />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {dropdownOpen && geometry && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "fixed", top: geometry.top, left: geometry.left, width: geometry.width }}
              className={cn(
                "z-50 border backdrop-blur-xl shadow-2xl p-1.5 overflow-hidden",
                isAutoRouting
                  ? "border-orange-500/40 bg-popover/95 shadow-orange-500/10"
                  : "border-border/60 bg-popover/95 shadow-black/50",
              )}
            >
            {error ? (
              <p className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">{error}</p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onSubnetChange(null);
                setDropdownOpen(false);
              }}
              className={cn(
                "w-full px-3 py-2.5 text-[13px] font-medium transition-all duration-200 text-left rounded-lg flex items-center justify-between group",
                selectedSubnetId === null
                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                  : "text-muted-foreground hover:bg-orange-500/8 hover:text-orange-700 dark:hover:text-orange-300",
              )}
            >
              Auto routing
              {selectedSubnetId === null ? (
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
              ) : null}
            </button>
            <div className="my-1 h-px bg-orange-500/15" />
            {loading ? (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">Loading miners…</div>
            ) : subnets.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">
                No miners from engine. Start the service behind{" "}
                <code className="text-[11px]">/engine/v1/miners</code>.
              </div>
            ) : (
              subnets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSubnetChange(s.id);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 group",
                    selectedSubnetId === s.id
                      ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                      : "text-muted-foreground hover:bg-orange-500/8 hover:text-orange-700 dark:hover:text-orange-300",
                  )}
                >
                  <span className="truncate">{s.label}</span>
                  {selectedSubnetId === s.id ? (
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  ) : null}
                </button>
              ))
            )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
