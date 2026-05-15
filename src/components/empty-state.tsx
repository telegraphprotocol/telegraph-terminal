import { Braces, CalendarDays, ShieldCheck } from "lucide-react";
import { promptScenarios } from "@/lib/mock-data";

const iconMap: Record<string, React.ReactNode> = {
  plane: <CalendarDays size={18} className="text-primary" />,
  video: <ShieldCheck size={18} className="text-primary" />,
  trending: <Braces size={18} className="text-primary" />,
};

interface EmptyStateProps {
  onQuestionClick?: (text: string) => void;
}

export function EmptyState({ onQuestionClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      {/* Title */}
      <p className="lg:text-lg text-base text-muted-foreground tracking-wide">
        Select A Prompt See Results
      </p>

      {/* Cards — 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-[640px]">
        {promptScenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => onQuestionClick?.(s.prompt)}
            className="flex lg:flex-col flex-row lg:items-start items-center gap-4 p-4 rounded-2xl bg-card  border border-transparent hover:border-primary/20 transition-all text-left group cursor-pointer"
          >
            {/* Icon badge */}
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors flex-shrink-0">
              {iconMap[s.icon]}
            </div>

            {/* Prompt text */}
            <span className="text-sm text-foreground leading-snug">
              {s.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
