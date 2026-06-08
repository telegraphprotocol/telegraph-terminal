"use client";

import { Braces, CalendarDays, ShieldCheck, Terminal, Info, ChevronDown, Cpu, GitBranch, Trophy } from "lucide-react";
import { promptScenarios } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const iconMap: Record<string, React.ReactNode> = {
  plane: <CalendarDays size={18} />,
  video: <ShieldCheck size={18} />,
  trending: <Braces size={18} />,
};

const HOW_IT_WORKS = [
  {
    icon: <GitBranch size={13} />,
    label: "Intent Detection",
    desc: "Your query is parsed to identify the task domain — deepfake detection, weather forecast, financial data, or any other registered protocol category.",
  },
  {
    icon: <Trophy size={13} />,
    label: "Miner Ranking",
    desc: "Telegraph scores every registered miner against the detected intent using on-chain performance history, stake weight, and response accuracy — then selects the highest-ranked specialist.",
  },
  {
    icon: <Cpu size={13} />,
    label: "Verified Settlement",
    desc: "The winning miner processes your request and the result is verified on-chain via the Telegraph protocol before being returned to you — no trust required.",
  },
];

interface EmptyStateProps {
  onQuestionClick?: (text: string) => void;
}

export function EmptyState({ onQuestionClick }: EmptyStateProps) {
  const [howOpen, setHowOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-4 sm:px-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="relative w-16 h-16 border border-border/60 flex items-center justify-center mb-2 bg-card">
          <span className="absolute top-1 left-1 text-[10px] text-foreground/20 leading-none">┌</span>
          <span className="absolute top-1 right-1 text-[10px] text-foreground/20 leading-none">┐</span>
          <span className="absolute bottom-1 left-1 text-[10px] text-foreground/20 leading-none">└</span>
          <span className="absolute bottom-1 right-1 text-[10px] text-foreground/20 leading-none">┘</span>
          <Terminal size={28} className="text-foreground/80" />
        </div>

        <h2 className="text-xl font-bold tracking-[0.04em] text-foreground/90 uppercase">
          Welcome to Telegraph
        </h2>
        <p className="text-[13px] text-muted-foreground max-w-sm leading-relaxed font-mono">
          Select a neural protocol scenario to begin real-time verification and settlement.
        </p>

        {/* How it works toggle */}
        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-1"
        >
          <Info size={11} />
          How does this work?
          <ChevronDown
            size={11}
            className={`transition-transform duration-200 ${howOpen ? "rotate-180" : ""}`}
          />
        </button>
      </motion.div>

      {/* Expandable how-it-works panel */}
      <AnimatePresence>
        {howOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[720px] border border-border/50 bg-card"
          >
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
              <div className="h-3 w-px bg-foreground/40" />
              <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                How Telegraph Routes Your Query
              </p>
            </div>

            {/* Intro */}
            <div className="px-4 pt-4 pb-2">
              <p className="text-[12px] text-muted-foreground font-mono leading-relaxed">
                Unlike general-purpose AI, Telegraph doesn&apos;t use a single model. Every query is routed to the{" "}
                <span className="text-foreground font-bold">best-ranked specialist miner</span> for that exact task —
                verified and settled on-chain so results are trustless and auditable.
              </p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/40 px-0 pb-0">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.label} className="flex flex-col gap-2.5 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center border border-border/60 text-muted-foreground">
                      {step.icon}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-muted-foreground/40 tabular-nums">0{i + 1}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground">{step.label}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="border-t border-border/40 px-4 py-2.5">
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                ✦ The miner that answers your query is paid automatically via x402 micropayment — no intermediaries.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-[720px]">
        {promptScenarios.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onQuestionClick?.(s.prompt)}
            className="relative flex flex-col gap-4 p-5 bg-card border border-border/60 hover:border-foreground/20 hover:bg-foreground/5 transition-all duration-200 text-left group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent pointer-events-none" />
            <span className="absolute top-1.5 left-1.5 text-[8px] text-foreground/15 leading-none">┌</span>
            <span className="absolute top-1.5 right-1.5 text-[8px] text-foreground/15 leading-none">┐</span>

            <div className="w-9 h-9 border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground/30 transition-all duration-200">
              {iconMap[s.icon]}
            </div>

            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.25em]">
                {s.category}
              </p>
              <p className="text-[12px] font-medium text-foreground/70 leading-snug group-hover:text-foreground transition-colors font-mono">
                {s.prompt}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
