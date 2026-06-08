"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info, X, GitBranch, Trophy, Cpu } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const STEPS = [
  {
    icon: <GitBranch size={13} />,
    label: "Intent Detection",
    desc: "Your query is parsed to identify the task domain. Deepfake detection, weather forecast, financial data, and every other registered protocol category each maps to a dedicated subnet.",
  },
  {
    icon: <Trophy size={13} />,
    label: "Miner Ranking",
    desc: "Telegraph scores every registered miner against the detected intent using on-chain performance history, stake weight, and response accuracy. The highest-ranked specialist gets the job.",
  },
  {
    icon: <Cpu size={13} />,
    label: "Verified Settlement",
    desc: "The winning miner processes your request. The result is verified on-chain via the Telegraph protocol. The miner is paid via x402 micropayment. No intermediaries.",
  },
];

export function HowItWorksButton() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const panel = document.getElementById("how-it-works-panel");
      if (panel && !panel.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    setAnchorRect((e.currentTarget as HTMLButtonElement).getBoundingClientRect());
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="How it works"
        className="inline-flex items-center gap-1.5 whitespace-nowrap border border-amber-600/70 bg-amber-500/10 px-3 h-8 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600 transition-all hover:border-amber-600 hover:bg-amber-500/15 hover:text-amber-700 dark:border-amber-500/80 dark:text-amber-400 dark:hover:border-amber-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
      >
        <Info size={13} aria-hidden />
        <span>How it works</span>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && anchorRect && (
            <motion.div
              id="how-it-works-panel"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                top: anchorRect.bottom + 8,
                right: Math.max(8, window.innerWidth - anchorRect.right),
                maxWidth: "calc(100vw - 1rem)",
              }}
              className="fixed z-[9999] w-[min(calc(100vw-1rem),26rem)] border border-border/60 bg-card/95 backdrop-blur-[14px] shadow-2xl shadow-black/30"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-px bg-foreground/40" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    How Telegraph Works
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Intro */}
              <div className="px-4 pt-3 pb-2">
                <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                  Unlike general-purpose AI, Telegraph routes every query to the{" "}
                  <span className="text-foreground font-bold">best-ranked specialist miner</span> for that exact task.
                  Results are verified and settled on-chain.
                </p>
              </div>

              {/* Steps */}
              <div className="flex flex-col divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
                {STEPS.map((step, i) => (
                  <div key={step.label} className="flex gap-3 px-4 py-3">
                    <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                      <div className="flex size-6 items-center justify-center border border-border/60 text-muted-foreground">
                        {step.icon}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className="w-px flex-1 min-h-[12px] bg-border/40" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">0{i + 1}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">{step.label}</span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-border/40 px-4 py-2.5">
                <p className="text-[10px] font-mono text-muted-foreground/40">
                  ✦ Miners are paid automatically via x402 micropayment on every verified response.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
