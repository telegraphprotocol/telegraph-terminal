"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePaymentNetwork, PAYMENT_NETWORKS } from "@/lib/network-context";
import { cn } from "@/lib/utils";

export function NetworkSelector() {
  const { network, setNetwork } = usePaymentNetwork();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = PAYMENT_NETWORKS.find((n) => n.value === network)!;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative flex min-w-0 flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Payment network: ${current.label}`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 whitespace-nowrap border px-2.5 sm:px-3 text-left transition-all",
          "focus:outline-none",
          "border-emerald-600/50 bg-emerald-500/10 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400",
          "hover:border-emerald-600/70 hover:bg-emerald-500/15 hover:text-emerald-800 dark:hover:border-emerald-500/60 dark:hover:text-emerald-300",
        )}
      >
        {/* pulse dot */}
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-60 dark:bg-emerald-400" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
        </span>

        <span className="hidden sm:inline">{current.label}</span>

        <ChevronDown size={12} className="shrink-0 text-emerald-700/70 dark:text-emerald-400/70" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            aria-label="Select payment network"
            className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] border border-emerald-500/30 bg-popover/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            {PAYMENT_NETWORKS.map((n) => (
              <button
                key={n.value}
                type="button"
                role="option"
                aria-selected={n.value === network}
                onClick={() => { setNetwork(n.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200",
                  n.value === network
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground hover:bg-emerald-500/8 hover:text-emerald-700 dark:hover:text-emerald-300",
                )}
              >
                <span className="truncate">{n.label}</span>
                {n.value === network && (
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
