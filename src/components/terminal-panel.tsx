"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, Activity, ShieldCheck, Zap, Copy, Check } from "lucide-react";
import { TerminalLogEntry, TerminalReceipt } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { LiveTerminalReceipt } from "@/lib/hooks/use-live-executor";

type TerminalReceiptLike = LiveTerminalReceipt | TerminalReceipt;

function isLiveReceipt(receipt: TerminalReceiptLike): receipt is LiveTerminalReceipt {
  return "subnet" in receipt;
}

interface TerminalPanelProps {
  logs: TerminalLogEntry[];
  showReceipt: boolean;
  receipt: TerminalReceiptLike | null;
}

const MAX_TECH_JSON_CHARS = 120_000;

type TerminalAccordionId = "payment-rail" | "settlement-receipt";

function formatTechnicalDetailsJson(payload: unknown): string {
  try {
    let s = JSON.stringify(payload, null, 2);
    if (s.length > MAX_TECH_JSON_CHARS) {
      const omitted = s.length - MAX_TECH_JSON_CHARS;
      s = `${s.slice(0, MAX_TECH_JSON_CHARS)}\n\n/* …truncated (${omitted.toLocaleString()} chars omitted) */`;
    }
    return s;
  } catch {
    return String(payload);
  }
}

function TechnicalDetailsCopyRow({ payload }: { payload: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = formatTechnicalDetailsJson(payload);
  const byteLabel =
    `${new TextEncoder().encode(text).length.toLocaleString()} bytes`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="rounded-lg border border-border/35 bg-muted/10 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Technical details
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground/80">
            Pretty JSON from engine{" "}
            <code className="rounded bg-muted px-1 py-px text-[9px]">result</code>
            <span className="text-muted-foreground/55"> · {byteLabel}</span>
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/50 bg-background/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              title="Copies full pretty-printed JSON to the clipboard."
            >
              {copied ? (
                <>
                  <Check size={13} className="text-success" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={13} aria-hidden />
                  Copy JSON
                </>
              )}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-[11px]">
              Copies full pretty-printed JSON to the clipboard (no preview in UI).
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

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
  const receiptAvailable = showReceipt && !!receipt;
  const [activeAccordion, setActiveAccordion] =
    useState<TerminalAccordionId>("payment-rail");

  useEffect(() => {
    if (!receiptAvailable && activeAccordion === "settlement-receipt") {
      setActiveAccordion("payment-rail");
    }
  }, [receiptAvailable, activeAccordion]);

  useEffect(() => {
    if (activeAccordion !== "payment-rail") return;
    const container = logContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [logs, activeAccordion]);

  const entriesWithHeader = logs.map((log, i) => ({
    log,
    showHeader: receiptAvailable
      ? i === 0
        ? log.section !== "Payment & Rail"
        : log.section !== logs[i - 1]!.section
      : i === 0 || log.section !== logs[i - 1]!.section,
  }));

  const logsOpen = !receiptAvailable || activeAccordion === "payment-rail";
  const receiptOpen = receiptAvailable && activeAccordion === "settlement-receipt";

  const paymentRailHeader = receiptAvailable ? (
    <button
      type="button"
      onClick={() => setActiveAccordion("payment-rail")}
      aria-expanded={logsOpen}
      className={cn(
        "flex w-full shrink-0 items-center gap-3 py-2 text-left transition-colors lg:px-5 px-4",
        "cursor-pointer hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        logsOpen && "bg-primary/[0.03]",
      )}
    >
      <div className="h-px flex-1 bg-border/40" />
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
        Payment &amp; Rail
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-primary/50 transition-transform duration-200",
            logsOpen && "rotate-180",
          )}
          aria-hidden
        />
      </span>
      <div className="h-px flex-1 bg-border/40" />
    </button>
  ) : (
    <div className="flex w-full shrink-0 items-center gap-3 py-2 lg:px-5 px-4">
      <div className="h-px flex-1 bg-border/40" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">
        Payment &amp; Rail
      </span>
      <div className="h-px flex-1 bg-border/40" />
    </div>
  );

  const logScroller = (
    <div
      ref={logContainerRef}
      className="min-h-0 flex-1 overflow-y-auto lg:px-5 px-4 pb-4 pt-1 custom-scrollbar"
    >
      {logs.length === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-xs text-muted-foreground/60 italic"
        >
          Waiting for network signal...
        </motion.p>
      ) : (
        <div className="space-y-1 py-2">
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

                <div className="flex items-start gap-4 rounded-md px-2 py-3 -mx-2 transition-colors hover:bg-primary/5">
                  <div className="flex min-w-16 flex-col items-center gap-1 pt-0.5">
                    <span className="text-[9px] font-mono tabular-nums leading-none text-muted-foreground/70">
                      {log.time.split(".")[0]}
                    </span>
                    <span className="text-[8px] font-mono tabular-nums leading-none text-primary/40">
                      .{log.time.split(".")[1]}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase leading-none tracking-wider text-foreground/90">
                        {log.label}
                      </span>
                      <div className="h-1 w-1 rounded-full bg-primary/30" />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground/80">
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
  );

  const receiptBody =
    receipt && receiptOpen ? (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-background/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 custom-scrollbar lg:px-5">
          <div className="grid min-h-0 w-full grid-cols-2 gap-x-6 gap-y-4">
            {(isLiveReceipt(receipt)
              ? [
                  {
                    label: "Subnet Provider",
                    value: `${receipt.subnet} (SN${receipt.subnetId})`,
                    icon: Activity,
                  },
                  { label: "Intent", value: receipt.intent || "n/a", icon: ShieldCheck },
                  { label: "Cost (USD)", value: `$${receipt.costUsd.toFixed(4)}`, icon: Zap },
                  { label: "Duration", value: `${receipt.durationMs}ms`, icon: Activity },
                ]
              : [
                  { label: "Subnet Provider", value: receipt.provider, icon: Activity },
                  { label: "Confidence Score", value: receipt.confidence, icon: ShieldCheck },
                  { label: "Network Fee", value: receipt.settlementCost, icon: Zap },
                  {
                    label: "System Clock",
                    value: receipt.timestamp.split(" ")[1] || receipt.timestamp,
                    icon: Activity,
                  },
                ]
            ).map(({ label, value, icon: Icon }) => (
              <div key={label} className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <Icon size={10} className="shrink-0 opacity-50" />
                  {label}
                </div>
                <div className="min-w-0 text-[13px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere] break-words tabular-nums">
                  {value}
                </div>
              </div>
            ))}
            {isLiveReceipt(receipt) && receipt.x402ExplorerUrl ? (
              <div className="col-span-2 min-w-0 space-y-1 border-t border-border/30 pt-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payment (x402)
                </div>
                <a
                  href={receipt.x402ExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block max-w-full min-w-0 break-all text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {receipt.x402TxHash
                    ? `${receipt.x402TxHash.slice(0, 10)}…${receipt.x402TxHash.slice(-6)}`
                    : "View on explorer"}
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-5 shrink-0 space-y-3 border-t border-border/40 pt-4">
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Execution time
              </div>
              <p className="text-[11px] font-mono leading-relaxed text-muted-foreground [overflow-wrap:anywhere] break-words">
                {receipt.timestamp}
              </p>
            </div>
            {isLiveReceipt(receipt) ? (
              <div className="min-w-0 space-y-1">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Router reasoning
                </div>
                <p className="text-[12px] leading-relaxed text-foreground/90 [overflow-wrap:anywhere] break-words">
                  {receipt.reasoning?.trim() || "—"}
                </p>
              </div>
            ) : (
              <p className="font-mono text-[10px] text-muted-foreground/70">TELEG_V1.0_PROD</p>
            )}
            {isLiveReceipt(receipt) ? (
              <TechnicalDetailsCopyRow payload={receipt.technicalDetails ?? null} />
            ) : null}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-lg",
        className,
      )}
    >
      {receiptAvailable ? (
        <>
          {paymentRailHeader}
          {logsOpen ? (
            <div className="flex min-h-0 flex-1 flex-col">{logScroller}</div>
          ) : null}

          <button
            type="button"
            onClick={() => setActiveAccordion("settlement-receipt")}
            aria-expanded={receiptOpen}
            className={cn(
              "flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/35 py-3 text-left transition-colors lg:px-5 px-4",
              "cursor-pointer hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              receiptOpen && "bg-primary/[0.03]",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="rounded-md bg-primary/10 p-1.5">
                <ShieldCheck size={14} className="text-primary" />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-tight text-foreground">
                Settlement Receipt
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-success">
                <div className="h-1 w-1 animate-pulse rounded-full bg-success" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Verified</span>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  "text-muted-foreground transition-transform duration-200",
                  receiptOpen && "rotate-180",
                )}
                aria-hidden
              />
            </div>
          </button>
          {receiptBody ? <div className="min-h-0 flex-1 px-3 pb-3 pt-0 lg:px-4">{receiptBody}</div> : null}
        </>
      ) : (
        <>
          {paymentRailHeader}
          {logScroller}
        </>
      )}
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
              <TooltipContent className="glass-card max-w-[240px] p-3 text-[11px] leading-relaxed text-popover-foreground">
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
