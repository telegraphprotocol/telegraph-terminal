"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { TerminalLogEntry, TerminalReceipt } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
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

interface TerminalFeedProps extends TerminalPanelProps {
  className?: string;
}

/** Shared log list + receipt (used by desktop aside and mobile collapsible). */
function TerminalFeed({
  logs,
  showReceipt,
  receipt,
  className,
}: TerminalFeedProps) {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = logContainerRef.current;
    if (!container) return;

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
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-lg",
        className,
      )}
    >
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto lg:px-5 px-4 lg:pt-0 pt-2"
        style={{ paddingBottom: receiptVisible ? RECEIPT_H + 20 : 16 }}
      >
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Waiting for request…</p>
        ) : (
          <div>
            {entriesWithHeader.map(({ log, showHeader }, i) => (
              <div key={i} className="terminal-log-entry">
                {showHeader && (
                  <div className={i > 0 ? "lg:mt-6 mt-4" : ""}>
                    <div className="flex items-center gap-3 py-2">
                      <span className="min-w-20 text-xs font-medium text-foreground/70">
                        Time
                      </span>
                      <span className="pl-1.5 text-xs font-medium text-foreground/70">
                        {log.section}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                  </div>
                )}

                <div className="flex items-center gap-3 border-b border-border/40 lg:py-3 py-2">
                  <div className="flex min-w-20 shrink-0 items-center justify-center rounded-full bg-muted px-2.5 py-1.5">
                    <span className="text-[10px] font-medium tabular-nums leading-none whitespace-nowrap text-foreground">
                      {log.time}
                    </span>
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[11px] font-semibold uppercase leading-none tracking-wide text-foreground">
                      {log.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {log.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute right-0 left-0 h-12 transition-opacity duration-500 lg:block hidden"
        style={{
          bottom: receiptVisible ? RECEIPT_H : 0,
          opacity: receiptVisible ? 1 : 0,
          background:
            "linear-gradient(to bottom, transparent 0%, var(--background) 100%)",
        }}
      />

      <div
        className={cn(
          "absolute right-0 bottom-0 left-0 border-t border-border bg-background/40 lg:px-5 px-4 py-5 backdrop-blur-lg transition-all duration-500 ease-out rounded-b-lg",
          receiptVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <p className="lg:mb-3 mb-2 text-[13px] font-medium tracking-wide text-foreground">
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
                className="flex items-baseline justify-between gap-2"
              >
                <span className="shrink-0 text-xs text-muted-foreground">
                  {label}
                </span>
                <span className="text-right text-xs font-medium text-foreground">
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileTerminalCollapsible({
  logs,
  showReceipt,
  receipt,
  isLoading,
}: TerminalPanelProps & { isLoading: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading) setOpen(false);
  }, [isLoading]);

  const expanded = isLoading || open;

  return (
    <div className="border border-border bg-background rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <span className="text-sm font-medium text-foreground">
          Live Settlement &amp; Logic Feed
        </span>
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="flex max-h-[min(50vh,360px)] min-h-[200px] flex-col border-t border-border">
          <TerminalFeed
            logs={logs}
            showReceipt={showReceipt}
            receipt={receipt}
            className="min-h-0 flex-1"
          />
        </div>
      )}
    </div>
  );
}

export function TerminalPanel({
  logs,
  showReceipt,
  receipt,
}: TerminalPanelProps) {
  return (
    <aside className="relative flex h-full w-[344px] shrink-0 flex-col overflow-hidden border-l border-border bg-background">
      <div className="shrink-0 px-5 pt-5 pb-4">
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
        <p className="mt-0.5 text-xs text-muted-foreground">
          Live Settlement &amp; Logic Feed
        </p>
      </div>

      <TerminalFeed
        logs={logs}
        showReceipt={showReceipt}
        receipt={receipt}
        className="min-h-0 flex-1"
      />
    </aside>
  );
}
