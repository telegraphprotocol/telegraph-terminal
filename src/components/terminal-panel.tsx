"use client";

import { useEffect, useRef } from "react";
import { HelpCircle } from "lucide-react";
import { TerminalLogEntry, TerminalReceipt } from "@/lib/mock-data";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TerminalPanelProps {
  logs: TerminalLogEntry[];
  showReceipt: boolean;
  receipt: TerminalReceipt | null;
}

const RECEIPT_H = 156; // px — bottom padding so last log is never hidden behind receipt

export function TerminalPanel({
  logs,
  showReceipt,
  receipt,
}: TerminalPanelProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

    // Keep auto-scroll isolated to the log container.
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [logs, showReceipt]);

  const entriesWithHeader = logs.map((log, i) => ({
    log,
    showHeader: i === 0 || log.section !== logs[i - 1].section,
  }));

  const receiptVisible = showReceipt && !!receipt;

  return (
    <aside className="relative flex flex-col w-[344px] shrink-0 border-l border-border bg-background h-full overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-medium text-foreground">Terminal</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <button
                  type="button"
                  aria-label="Terminal info"
                  className="inline-flex items-center text-muted-foreground"
                >
                  <HelpCircle size={13} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Streams real-time execution logs for provider routing, model
                inference, validation checks, and final onchain settlement
                receipt generation.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Live Settlement &amp; Logic Feed
        </p>
      </div>

      {/* ── Scrollable log feed ──────────────────────────────────────── */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: receiptVisible ? RECEIPT_H + 20 : 16 }}
      >
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Waiting for request…</p>
        ) : (
          <div>
            {entriesWithHeader.map(({ log, showHeader }, i) => (
              <div key={i} className="terminal-log-entry">
                {/* Section header: "Time | Section Name" + divider */}
                {showHeader && (
                  <div className={i > 0 ? "mt-6" : ""}>
                    <div className="flex items-center py-2 gap-3">
                      <span className="text-xs text-foreground/70 font-medium min-w-20">
                        Time
                      </span>
                      <span className="text-xs text-foreground/70 font-medium pl-1.5">
                        {log.section}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                  </div>
                )}

                {/* Log row */}
                <div className="flex items-center gap-3 py-3 border-b border-border/40">
                  {/* Timestamp pill */}
                  <div className="flex items-center justify-center shrink-0 px-2.5 py-1.5 rounded-full bg-muted min-w-20">
                    <span className="text-[10px] text-foreground tabular-nums leading-none whitespace-nowrap font-medium">
                      {log.time}
                    </span>
                  </div>
                  {/* Label + detail */}
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide leading-none">
                      {log.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-1">
                      {log.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Gradient fade — sits just above the receipt ──────────────── */}
      <div
        className="absolute left-0 right-0 h-12 pointer-events-none transition-opacity duration-500"
        style={{
          bottom: receiptVisible ? RECEIPT_H : 0,
          opacity: receiptVisible ? 1 : 0,
          background:
            "linear-gradient(to bottom, transparent 0%, var(--background) 100%)",
        }}
      />

      {/* ── Receipt — pinned at bottom, backdrop blur ────────────────── */}
      <div
        className={`
          absolute bottom-0 left-0 right-0
          px-5 py-5
          bg-background/40 backdrop-blur-lg
          border-t border-border
          transition-all duration-500 ease-out
          ${receiptVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}
        `}
      >
        <p className="text-[13px] font-medium text-foreground mb-3 tracking-wide">
          Receipt Generated
        </p>
        {receipt && (
          <div className="space-y-2">
            {[
              { label: "Provider:", value: receipt.provider },
              { label: "Timestamp:", value: receipt.timestamp },
              { label: "Confidence:", value: receipt.confidence },
              { label: "Settlement Cost:", value: receipt.settlementCost },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-baseline gap-2"
              >
                <span className="text-xs text-muted-foreground shrink-0">
                  {label}
                </span>
                <span className="text-xs text-foreground font-medium text-right">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
