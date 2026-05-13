"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, Activity, ShieldCheck, Zap } from "lucide-react";
import { TerminalLogEntry } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { LiveTerminalReceipt } from "@/lib/hooks/use-live-executor";
import { TerminalReceipt } from "@/lib/mock-data";

type TerminalReceiptLike = LiveTerminalReceipt | TerminalReceipt;

function isLiveReceipt(receipt: TerminalReceiptLike): receipt is LiveTerminalReceipt {
  return "subnet" in receipt;
}

interface TerminalPanelProps {
  logs: TerminalLogEntry[];
  showReceipt: boolean;
  receipt: TerminalReceiptLike | null;
}

const RECEIPT_H = 180; // px — bottom padding so last log is never hidden behind receipt

interface TerminalFeedProps extends TerminalPanelProps {
  className?: string;
}

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
        className="flex-1 overflow-y-auto lg:px-5 px-4 lg:pt-0 pt-2 custom-scrollbar"
        style={{ paddingBottom: receiptVisible ? RECEIPT_H + 20 : 16 }}
      >
        {logs.length === 0 ? (
          true ? (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground/60 italic mt-4"
            >
              Waiting for network signal...
            </motion.p>
          ) : null
        ) : (
          <div className="space-y-1 py-4">
            <AnimatePresence mode="popLayout">
              {entriesWithHeader.map(({ log, showHeader }, i) => (
                <motion.div 
                  key={`${log.time}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="group"
                >
                  {showHeader && (
                    <div className={i > 0 ? "lg:mt-8 mt-6" : ""}>
                      <div className="flex items-center gap-3 py-2">
                        <div className="h-px flex-1 bg-border/40" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
                          {log.section}
                        </span>
                        <div className="h-px flex-1 bg-border/40" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4 py-3 transition-colors hover:bg-primary/5 rounded-md px-2 -mx-2">
                    <div className="flex flex-col items-center gap-1 min-w-16 pt-0.5">
                      <span className="text-[9px] font-mono tabular-nums leading-none text-muted-foreground/70">
                        {log.time.split('.')[0]}
                      </span>
                      <span className="text-[8px] font-mono tabular-nums leading-none text-primary/40">
                        .{log.time.split('.')[1]}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase leading-none tracking-wider text-foreground/90">
                          {log.label}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-primary/30" />
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground/80 transition-colors">
                        {log.detail}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Glossy Receipt */}
      <AnimatePresence>
        {receiptVisible && (
          <motion.div
            initial={{ translateY: "100%", opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="absolute right-0 bottom-0 left-0 border-t border-border/50 bg-background/80 lg:px-6 px-4 py-6 backdrop-blur-xl rounded-t-2xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-10"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <ShieldCheck size={14} className="text-primary" />
                </div>
                <p className="text-[12px] font-bold tracking-tight text-foreground uppercase">
                  Settlement Receipt
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                <div className="w-1 h-1 rounded-full bg-success animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Verified</span>
              </div>
            </div>

            {receipt && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {(isLiveReceipt(receipt)
                  ? [
                      { label: "Subnet Provider", value: `${receipt.subnet} (SN${receipt.subnetId})`, icon: Activity },
                      { label: "Intent", value: receipt.intent || "n/a", icon: ShieldCheck },
                      { label: "Cost (USD)", value: `$${receipt.costUsd.toFixed(4)}`, icon: Zap },
                      { label: "Duration", value: `${receipt.durationMs}ms`, icon: Activity },
                    ]
                  : [
                      { label: "Subnet Provider", value: receipt.provider, icon: Activity },
                      { label: "Confidence Score", value: receipt.confidence, icon: ShieldCheck },
                      { label: "Network Fee", value: receipt.settlementCost, icon: Zap },
                      { label: "System Clock", value: receipt.timestamp.split(" ")[1] || receipt.timestamp, icon: Activity },
                    ]
                ).map(({ label, value, icon: Icon }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      <Icon size={10} className="opacity-50" />
                      {label}
                    </div>
                    <div className="text-[13px] font-semibold text-foreground tabular-nums">
                      {value}
                    </div>
                  </div>
                ))}
                {isLiveReceipt(receipt) && receipt.x402ExplorerUrl ? (
                  <div className="col-span-2 space-y-1 border-t border-border/30 pt-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      Payment (x402)
                    </div>
                    <a
                      href={receipt.x402ExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block max-w-full truncate text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {receipt.x402TxHash
                        ? `${receipt.x402TxHash.slice(0, 10)}…${receipt.x402TxHash.slice(-6)}`
                        : "View on explorer"}
                    </a>
                  </div>
                ) : null}
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-border/40 flex justify-between items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest truncate">
                  {receipt.timestamp}
                </span>
                <span className="text-[9px] font-mono text-primary/60 truncate">
                  {isLiveReceipt(receipt) ? (receipt.reasoning || "ROUTER_REASONING_UNAVAILABLE") : "TELEG_V1.0_PROD"}
                </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

  const expanded = isLoading || open;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-4 text-left transition-colors duration-200 hover:bg-accent/30"
      >
        <div className="flex items-center gap-2">
            <div className="relative">
                <Activity size={16} className="text-primary" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">
              Live Intelligence Feed
            </span>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-500 ease-[0.16, 1, 0.3, 1]",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid border-t border-border/40 transition-[grid-template-rows] duration-500 ease-[0.16, 1, 0.3, 1]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex max-h-[min(60vh,420px)] min-h-[240px] flex-col">
            <TerminalFeed
              logs={logs}
              showReceipt={showReceipt}
              receipt={receipt}
              className="min-h-0 flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TerminalPanel({
  logs,
  showReceipt,
  receipt,
}: TerminalPanelProps) {
  return (
    <aside className="relative flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-border/40 bg-background/30 backdrop-blur-sm">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-foreground/80">Terminal</h2>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
                <span className="text-[8px] font-black uppercase">Live</span>
            </div>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="p-1 rounded-full hover:bg-muted transition-colors cursor-help">
                  <HelpCircle size={14} className="text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="glass-card max-w-[240px] p-3 text-[11px] leading-relaxed">
                Real-time execution logs for provider routing, model
                inference, validation checks, and on-chain settlement.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="mt-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-60">
          Settlement &amp; Logic Rail
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
