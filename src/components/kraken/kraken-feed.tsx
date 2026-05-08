"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Copy, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DaemonResultItem } from "@/lib/engine-daemon-types";

interface KrakenFeedProps {
  items: DaemonResultItem[];
  loading?: boolean;
}

const statusConfig = {
  success: { label: "Success", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  error: { label: "Error", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: AlertCircle },
};

export function KrakenFeed({ items, loading }: KrakenFeedProps) {
  return (
    <div className="w-full bg-card rounded-3xl overflow-hidden border border-border/50">
      <div className="grid grid-cols-[110px_1fr_150px_130px_90px_130px_60px] gap-3 px-4 py-3 border-b border-border/50 bg-muted/20">
        {["TIMESTAMP", "SKILL USED", "INPUT SNIPPET", "STATUS", "COST", "SOURCE", "PROOF"].map((header) => (
          <div key={header} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {header}
          </div>
        ))}
      </div>
      
      <div className="divide-y divide-border/30">
        {loading && items.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">Loading signal feed...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">No signal rows found for the selected filters.</div>
        )}
        {items.map((log, i) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="grid grid-cols-[110px_1fr_150px_130px_90px_130px_60px] gap-3 px-4 py-3 items-center hover:bg-muted/10 transition-colors"
          >
            <div className="text-xs font-medium text-white/70 tabular-nums">
              {new Date(log.created_at).toLocaleTimeString()}
            </div>
            <div className="text-[12px] font-semibold text-white tracking-tight truncate">
              {log.routing.subnet_name || "unknown"} {log.routing.subnet_id ? `(SN${log.routing.subnet_id})` : ""}
            </div>
            <div className="text-[10px] text-muted-foreground truncate font-mono">
              {log.question.text || "No question text"}
            </div>
            <div>
              {statusConfig[log.status] && (
                (() => {
                  const StatusIcon = statusConfig[log.status].icon;
                  return (
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                  statusConfig[log.status].color
                )}>
                  <StatusIcon size={10} />
                  {statusConfig[log.status].label}
                </div>
                  );
                })()
              )}
            </div>
            <div>
              <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-bold shadow-lg shadow-primary/20">
                ${log.execution.cost_usd.toFixed(4)}
              </div>
            </div>
            <div className="flex items-center gap-2 group">
              <span className="text-[12px] text-white/90 font-mono tracking-tighter">{log.source}</span>
              <Copy size={12} className="text-muted-foreground group-hover:text-primary transition-colors cursor-pointer" />
            </div>
            {/* Not a separate proof API — icon is a visual cue; native title shows error/reasoning snippet. */}
            <div className="flex justify-center">
              <span
                title={
                  log.execution.error ||
                  log.routing.reasoning ||
                  "No routing details stored for this row."
                }
              >
                <ReceiptText
                  size={16}
                  className="text-muted-foreground hover:text-white cursor-pointer transition-colors"
                  aria-hidden
                />
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
