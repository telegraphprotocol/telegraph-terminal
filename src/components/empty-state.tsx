"use client";

import { Braces, CalendarDays, ShieldCheck, Terminal } from "lucide-react";
import { promptScenarios } from "@/lib/mock-data";
import { motion } from "framer-motion";

const iconMap: Record<string, React.ReactNode> = {
  plane: <CalendarDays size={18} />,
  video: <ShieldCheck size={18} />,
  trending: <Braces size={18} />,
};

interface EmptyStateProps {
  onQuestionClick?: (text: string) => void;
}

export function EmptyState({ onQuestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <div className="relative w-16 h-16 border border-border/60 flex items-center justify-center mb-2 bg-card">
          {/* ASCII corner brackets */}
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
      </motion.div>

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
            {/* Subtle gloss */}
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent pointer-events-none" />
            {/* Corner marks */}
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
