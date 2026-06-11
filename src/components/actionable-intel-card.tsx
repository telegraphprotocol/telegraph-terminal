import { Zap } from "lucide-react";

interface ActionableIntelCardProps {
  text: string;
}

export function ActionableIntelCard({ text }: ActionableIntelCardProps) {
  return (
    <div className="border border-border/60 bg-card p-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-1">
          ACTIONABLE INTEL
        </p>
        <p className="text-sm text-muted-foreground font-mono">{text}</p>
      </div>
      <div className="shrink-0 w-8 h-8 border border-border/60 flex items-center justify-center bg-muted">
        <Zap size={14} className="text-muted-foreground" />
      </div>
    </div>
  );
}
