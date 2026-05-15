"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export type EngineSubnetPickerProps = {
  subnets: Array<{ id: string; label: string }>;
  selectedSubnetId: string | null;
  onSubnetChange: (subnetId: string | null) => void;
  loading?: boolean;
  error?: string | null;
  /** When true, only "Auto routing" is selectable (paid chat v1). */
  paidChatAutoOnly?: boolean;
  /** Dropdown alignment under the trigger */
  menuAlign?: "start" | "end";
};

export function EngineSubnetPicker({
  subnets,
  selectedSubnetId,
  onSubnetChange,
  loading = false,
  error = null,
  paidChatAutoOnly = false,
  menuAlign = "end",
}: EngineSubnetPickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const engineUnreachable = Boolean(error) && subnets.length === 0 && !loading;

  const primaryLabel = loading
    ? "Loading subnets…"
    : selectedSubnetId
      ? subnets.find((s) => s.id === selectedSubnetId)?.label ?? `SN${selectedSubnetId}`
      : engineUnreachable
        ? "Engine offline"
        : "Auto routing";

  const menuPosition =
    menuAlign === "end" ? "right-0" : "left-0";

  return (
    <div className="relative flex min-w-0 flex-col gap-0.5" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full max-w-full items-center gap-2 rounded-lg border px-3 text-left transition-colors",
          "lg:w-auto lg:max-w-[min(260px,calc(100vw-14rem))]",
          "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          engineUnreachable ? "border-amber-500/40 bg-amber-500/5" : "border-border",
        )}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        aria-label={`Subnet routing: ${primaryLabel}`}
      >
        <span className="truncate text-[14px] font-medium leading-tight text-foreground">
          {primaryLabel}
        </span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute top-[calc(100%+8px)] z-50 min-w-[220px] max-w-[min(90vw,280px)] rounded-2xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-primary/20 p-1.5 overflow-hidden",
              menuPosition,
            )}
          >
            {error ? (
              <p className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">{error}</p>
            ) : null}
            {paidChatAutoOnly ? (
              <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
                Paid chat: auto routing only for now.
              </p>
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
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              Auto routing
              {selectedSubnetId === null ? (
                <div className="h-1 w-1 shrink-0 rounded-full bg-primary" />
              ) : null}
            </button>
            <div className="my-1 h-px bg-border/40" />
            {loading ? (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">Loading subnets…</div>
            ) : subnets.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">
                No subnets from engine. Start the service behind{" "}
                <code className="text-[11px]">/v1/subnets</code>.
              </div>
            ) : (
              subnets.map((s) => {
                const disabled = paidChatAutoOnly;
                return (
                <button
                  key={s.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) return;
                    onSubnetChange(s.id);
                    setDropdownOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200 group",
                    disabled
                      ? "cursor-not-allowed opacity-45"
                      : selectedSubnetId === s.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span className="truncate">{s.label}</span>
                  {selectedSubnetId === s.id ? (
                    <div className="h-1 w-1 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
