"use client";

import { Braces, CalendarDays, ShieldCheck, Sparkles } from "lucide-react";
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
        <div className="w-16 h-16 rounded-2xl bg-gradient-premium flex items-center justify-center shadow-xl shadow-primary/20 mb-2">
           <Sparkles size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground/90">Welcome to Telegraph</h2>
        <p className="text-[15px] text-muted-foreground/80 max-w-sm">
          Select a neural protocol scenario to begin real-time verification and settlement.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-[720px]">
        {promptScenarios.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => onQuestionClick?.(s.prompt)}
            className="flex flex-col gap-4 p-5 rounded-3xl bg-background/40 border border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:shadow-2xl hover:shadow-primary/10 transition-all text-left group relative overflow-hidden"
          >
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
              {iconMap[s.icon]}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{s.category}</p>
              <p className="text-[13px] font-semibold text-foreground/80 leading-snug group-hover:text-foreground transition-colors">
                {s.prompt}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
