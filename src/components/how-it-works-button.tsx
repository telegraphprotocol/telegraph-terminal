"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Info, X, GitBranch, Trophy, Cpu } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface HowItWorksStep {
  icon: React.ReactNode;
  label: string;
  desc: string;
}

const TERMINAL_TITLE = "How Telegraph Works";
const TERMINAL_INTRO = (
  <>
    Telegraph doesn&apos;t send your request to a random AI model. It automatically routes it to{" "}
    <span className="text-foreground font-bold">the best-performing miners</span> for that specific task.
  </>
);
const TERMINAL_STEPS: HowItWorksStep[] = [
  {
    icon: <GitBranch size={13} />,
    label: "Understanding the Request",
    desc: "When you (or your autonomous agent) send a request, Telegraph first identifies what kind of intelligence you need — for example, deepfake detection, weather forecasting, financial risk, or pharma research.",
  },
  {
    icon: <Trophy size={13} />,
    label: "Smart Routing",
    desc: "The system checks the live leaderboard and routes your request to the highest-performing miners for that task. Miners with better accuracy have a higher chance of handling your request.",
  },
  {
    icon: <Cpu size={13} />,
    label: "Answer + Receipt",
    desc: "The selected miner processes your request and returns the answer. You receive a verified Signal along with a cryptographic receipt, proving the answer was checked by validators — including final output, confidence score, cost, timestamp, and source.",
  },
];
const TERMINAL_FOOTER = (
  <>
    You pay a small fee via x402 micropayment (starting from $0.01, depending on demand) for transparent,
    verifiable intelligence you can use directly in your systems or agents.
    <br />
    <br />
    Miner quality and leaderboard rankings are maintained through periodic tournaments and spot checks, where
    validators score outputs against real-world ground truth using fixed scripts — keeping the network accurate
    over time.
  </>
);

interface HowItWorksButtonProps {
  title?: string;
  intro?: React.ReactNode;
  steps?: HowItWorksStep[];
  footer?: React.ReactNode;
  className?: string;
}

export function HowItWorksButton({
  title = TERMINAL_TITLE,
  intro = TERMINAL_INTRO,
  steps = TERMINAL_STEPS,
  footer = TERMINAL_FOOTER,
  className,
}: HowItWorksButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelId = useRef(`how-it-works-panel-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const panel = document.getElementById(panelId);
      if (panel && !panel.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, panelId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
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
        title="How it works"
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap border border-sky-600/70 bg-sky-500/10 px-2.5 sm:px-3 h-8 text-[10px] font-bold uppercase tracking-[0.1em] text-sky-600 transition-all hover:border-sky-600 hover:bg-sky-500/15 hover:text-sky-700 dark:border-sky-500/80 dark:text-sky-400 dark:hover:border-sky-400 dark:hover:bg-sky-500/20 dark:hover:text-sky-300",
          className,
        )}
      >
        <Info size={13} aria-hidden />
        <span className="hidden sm:inline">How it works</span>
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && anchorRect && (
            <motion.div
              id={panelId}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={{
                top: anchorRect.bottom + 8,
                right: Math.max(8, window.innerWidth - anchorRect.right),
                maxWidth: "calc(100vw - 1rem)",
              }}
              className="fixed z-[9999] w-[min(calc(100vw-1rem),26rem)] border border-border/50 bg-background/75 backdrop-blur-2xl shadow-2xl shadow-black/40"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-px bg-foreground/40" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                    {title}
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
                  {intro}
                </p>
              </div>

              {/* Steps */}
              <div className="flex flex-col divide-y divide-border/40 max-h-[60vh] overflow-y-auto">
                {steps.map((step, i) => (
                  <div key={step.label} className="flex gap-3 px-4 py-3">
                    <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                      <div className="flex size-6 items-center justify-center border border-border/60 text-muted-foreground">
                        {step.icon}
                      </div>
                      {i < steps.length - 1 && (
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
                <p className="text-[10px] font-mono text-muted-foreground/40 leading-relaxed">
                  {footer}
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
