"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Copy, ReceiptText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DaemonResultItem } from "@/lib/engine-daemon-types";
import { formatKrakenIntentCell } from "@/lib/kraken-signal-format";
import { summarizeExecutionResult } from "@/lib/kraken-signal-result";

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

function proofTitle(log: DaemonResultItem) {
  if (log.execution.error) return log.execution.error;
  const summary = summarizeExecutionResult(log.execution.result);
  if (summary && !summary.startsWith("No subnet result") && !summary.startsWith("Structured subnet")) {
    return summary;
  }
  return log.routing.reasoning || "No routing details stored for this row.";
}

function StatusBadge({ status }: { status: DaemonResultItem["status"] }) {
  if (statusConfig[status]) {
    const cfg = statusConfig[status];
    const StatusIcon = cfg.icon;
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold",
          cfg.color,
        )}
      >
        <StatusIcon size={10} />
        {cfg.label}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/50 text-[11px] font-semibold text-muted-foreground">
      Unknown
    </div>
  );
}

function CostBadge({ log }: { log: DaemonResultItem }) {
  return (
    <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-bold shadow-lg shadow-primary/20">
      ${Number(log.execution?.cost_usd ?? 0).toFixed(4)}
    </div>
  );
}

function SourceWithCopy({ log }: { log: DaemonResultItem }) {
  return (
    <div className="flex min-w-0 items-center gap-2 group">
      <span className="min-w-0 truncate text-[12px] text-white/90 font-mono tracking-tighter">{log.source}</span>
      <button
        type="button"
        title="Copy source"
        aria-label="Copy source name"
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          void navigator.clipboard.writeText(log.source);
        }}
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

function ProofIcon({ log }: { log: DaemonResultItem }) {
  return (
    <span title={proofTitle(log)}>
      <ReceiptText
        size={16}
        className="text-muted-foreground hover:text-white cursor-default transition-colors pointer-events-none"
        aria-hidden
      />
    </span>
  );
}

function DetailsChevron({
  log,
  onRowSelect,
}: {
  log: DaemonResultItem;
  onRowSelect?: (item: DaemonResultItem) => void;
}) {
  if (!onRowSelect) return null;
  return (
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
  );
}

function EmptyOrLoading({ loading, empty }: { loading: boolean; empty: boolean }) {
  if (loading && empty) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">Loading signal feed...</div>;
  }
  if (!loading && empty) {
    return <div className="px-4 py-6 text-sm text-muted-foreground">No signal rows found for the selected filters.</div>;
  }
  return null;
}

export function KrakenFeed({ items, loading, onRowSelect }: KrakenFeedProps) {
  const empty = items.length === 0;
  const emptySlot = <EmptyOrLoading loading={Boolean(loading)} empty={empty} />;

  return (
    <div className="w-full min-w-0 bg-card rounded-3xl overflow-hidden border border-border/50">
      {/* Compact layout: below lg */}
      <div className="lg:hidden">
        <div className="border-b border-border/50 bg-muted/20 px-4 py-3">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Signals</h3>
        </div>
        <div className="divide-y divide-border/30">
          {emptySlot}
          {items.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="space-y-3 p-4 transition-colors hover:bg-muted/10"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-white/70 tabular-nums">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <div className="flex shrink-0 items-center gap-0.5">
                  <div className="flex justify-center p-1">
                    <ProofIcon log={log} />
                  </div>
                  <DetailsChevron log={log} onRowSelect={onRowSelect} />
                </div>
              </div>
              <div
                className="text-[12px] font-semibold text-white tracking-tight break-words"
                title={formatKrakenIntentCell(log)}
              >
                {formatKrakenIntentCell(log)}
              </div>
              <p className="text-[11px] font-mono text-muted-foreground leading-relaxed break-words">
                {log.question.text || "No question text"}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <StatusBadge status={log.status} />
                <CostBadge log={log} />
                <div className="min-w-0 w-full basis-full sm:w-auto sm:basis-auto">
                  <SourceWithCopy log={log} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Table layout: lg and up */}
      <div className="hidden min-w-0 overflow-x-auto lg:block">
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
          {emptySlot}
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
                <StatusBadge status={log.status} />
              </div>
              <div>
                <CostBadge log={log} />
              </div>
              <div>
                <SourceWithCopy log={log} />
              </div>
              <div className="flex justify-center">
                <ProofIcon log={log} />
              </div>
              <div className="flex justify-center">
                <DetailsChevron log={log} onRowSelect={onRowSelect} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
