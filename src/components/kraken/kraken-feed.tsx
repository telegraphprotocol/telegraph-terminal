"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Copy, ReceiptText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DaemonResultItem } from "@/lib/engine-daemon-types";
import { formatKrakenIntentCell } from "@/lib/kraken-signal-format";

interface KrakenFeedProps {
  items: DaemonResultItem[];
  loading?: boolean;
  onRowSelect?: (item: DaemonResultItem) => void;
}

const statusConfig = {
  success: { label: "Success", color: "text-green-500 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  error: { label: "Error", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: AlertCircle },
};

const FEED_HEADERS = ["TIMESTAMP", "INTENT", "INPUT SNIPPET", "STATUS", "COST", "SOURCE", "PROOF", ""] as const;

const GRID_COLS = "grid-cols-[110px_1fr_150px_130px_90px_130px_60px_40px]";

export function KrakenFeed({ items, loading, onRowSelect }: KrakenFeedProps) {
  return (
    <div className="w-full bg-card rounded-3xl overflow-hidden border border-border/50">
      <div className={cn("grid gap-3 px-4 py-3 border-b border-border/50 bg-muted/20", GRID_COLS)}>
        {FEED_HEADERS.map((header) => (
          <div
            key={header === "" ? "feed-col-details" : header}
            className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
          >
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
            className={cn("grid gap-3 px-4 py-3 items-center hover:bg-muted/10 transition-colors", GRID_COLS)}
          >
            <div className="text-xs font-medium text-white/70 tabular-nums">
              {new Date(log.created_at).toLocaleTimeString()}
            </div>
            <div className="text-[12px] font-semibold text-white tracking-tight truncate" title={formatKrakenIntentCell(log)}>
              {formatKrakenIntentCell(log)}
            </div>
            <div className="text-[10px] text-muted-foreground truncate font-mono">
              {log.question.text || "No question text"}
            </div>
            <div>
              {statusConfig[log.status] ? (
                (() => {
                  const StatusIcon = statusConfig[log.status].icon;
                  return (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
                        statusConfig[log.status].color,
                      )}
                    >
                      <StatusIcon size={10} />
                      {statusConfig[log.status].label}
                    </div>
                  );
                })()
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 text-[11px] font-semibold text-muted-foreground">
                  Unknown
                </div>
              )}
            </div>
            <div>
              <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-bold shadow-lg shadow-primary/20">
                ${Number(log.execution?.cost_usd ?? 0).toFixed(4)}
              </div>
            </div>
            <div className="flex items-center gap-2 group">
              <span className="text-[12px] text-white/90 font-mono tracking-tighter">{log.source}</span>
              <button
                type="button"
                title="Copy source"
                aria-label="Copy source name"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => {
                  e.stopPropagation();
                  void navigator.clipboard.writeText(log.source);
                }}
              >
                <Copy size={12} />
              </button>
            </div>
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
                  className="text-muted-foreground hover:text-white cursor-default transition-colors pointer-events-none"
                  aria-hidden
                />
              </span>
            </div>
            <div className="flex justify-center">
              {onRowSelect ? (
                <button
                  type="button"
                  aria-label="View signal details"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRowSelect(log);
                  }}
                >
                  <ChevronRight size={18} aria-hidden />
                </button>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
