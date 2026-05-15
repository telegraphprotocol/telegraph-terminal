"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DaemonResultItem } from "@/lib/engine-daemon-types";
import { formatKrakenIntentCell } from "@/lib/kraken-signal-format";
import { parseExecutionResult, summarizeExecutionResult } from "@/lib/kraken-signal-result";
import { KrakenStructuredResult } from "@/components/kraken/kraken-structured-result";

function formatJsonPreview(value: unknown): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DetailRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-3 text-sm", className)}>
      <div className="font-semibold text-muted-foreground">{label}</div>
      <div className="text-white/90 break-words min-w-0">{children}</div>
    </div>
  );
}

function CopyJsonButton({
  text,
  className,
  copyLabel = "Copy full signal JSON",
}: {
  text: string;
  className?: string;
  copyLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);

  return (
    <button
      type="button"
      disabled={!canCopy}
      title={copied ? "Copied to clipboard" : copyLabel}
      aria-label={copied ? "Copied to clipboard" : `${copyLabel} to clipboard`}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 text-xs font-semibold text-white/90 transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      onClick={() => {
        if (!canCopy) return;
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          globalThis.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Copy size={14} aria-hidden />
      <span>{copied ? "Copied" : "Copy JSON"}</span>
    </button>
  );
}

export type KrakenSignalDetailsDialogProps = {
  item: DaemonResultItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KrakenSignalDetailsDialog({ item, open, onOpenChange }: KrakenSignalDetailsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !item) return null;

  const fullSignalJson = formatJsonPreview(item);
  const parsedResult = parseExecutionResult(item.execution.result);
  const { rawJson: resultRawJson, hasAnswer: hasStructuredAnswer } = parsedResult;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close details"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kraken-signal-details-title"
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl max-h-[min(92dvh,800px)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="kraken-signal-details-title" className="text-lg font-bold tracking-tight text-white">
              Signal details
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{item.id}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[min(calc(92dvh-7rem),calc(100dvh-9rem))] min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex flex-col gap-4 pb-2">
            <DetailRow label="Created">{new Date(item.created_at).toLocaleString()}</DetailRow>
            <DetailRow label="Type">{item.type}</DetailRow>
            <DetailRow label="Source">{item.source}</DetailRow>
            <DetailRow label="Status">{item.status}</DetailRow>
            <DetailRow label="Intent">{formatKrakenIntentCell(item)}</DetailRow>
            <DetailRow label="Result">
              <span className="whitespace-pre-wrap text-sm leading-relaxed">
                {item.execution.error || summarizeExecutionResult(item.execution.result)}
              </span>
            </DetailRow>

            <div className="border-t border-border/40 pt-3 mt-1">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Question</p>
              <DetailRow label="Text">
                <span className="whitespace-pre-wrap">{item.question.text || "—"}</span>
              </DetailRow>
              <DetailRow label="Category">{item.question.category || "—"}</DetailRow>
              <DetailRow label="Interest">{item.question.interest_score}</DetailRow>
              <DetailRow label="Affected %">{item.question.affected_pct}</DetailRow>
              <DetailRow label="Audience %">{item.question.audience_pct}</DetailRow>
            </div>

            <div className="border-t border-border/40 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Routing</p>
              <DetailRow label="Miner ID">{item.routing.subnet_id ?? "—"}</DetailRow>
              <DetailRow label="Miner name">{item.routing.subnet_name ?? "—"}</DetailRow>
              <DetailRow label="Intent (raw)">{item.routing.intent ?? "—"}</DetailRow>
              <DetailRow label="Reasoning">
                <span className="whitespace-pre-wrap">{item.routing.reasoning ?? "—"}</span>
              </DetailRow>
              <DetailRow label="Error stage">{item.routing.error_stage ?? "—"}</DetailRow>
            </div>

            <div className="border-t border-border/40 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution</p>
              <DetailRow label="Cost (USD)">{Number(item.execution.cost_usd ?? 0).toFixed(4)}</DetailRow>
              <DetailRow label="Duration (ms)">{item.execution.duration_ms}</DetailRow>
              <DetailRow label="Timestamp">{item.execution.timestamp || "—"}</DetailRow>
              <DetailRow label="Error">
                <span className={item.execution.error ? "text-red-400" : ""}>{item.execution.error ?? "—"}</span>
              </DetailRow>

              <div className="mt-4 border-t border-border/30 pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Result</p>
                  <CopyJsonButton text={resultRawJson} copyLabel="Copy result JSON" />
                </div>
                <KrakenStructuredResult result={item.execution.result} className={hasStructuredAnswer ? undefined : "mb-0"} />
                {!hasStructuredAnswer ? (
                  <pre className="mt-3 max-h-[min(40vh,360px)] overflow-auto rounded-lg border border-border/40 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-white/80">
                    {resultRawJson}
                  </pre>
                ) : (
                  <details className="mt-4 group">
                    <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground hover:text-white/90">
                      Raw result (JSON)
                    </summary>
                    <pre className="mt-2 max-h-[min(32vh,280px)] overflow-auto rounded-lg border border-border/40 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-white/80">
                      {resultRawJson}
                    </pre>
                  </details>
                )}
              </div>
            </div>

            <div className="border-t border-border/40 pt-3 pb-1">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Full signal (JSON)
                </p>
                <CopyJsonButton text={fullSignalJson} />
              </div>
              <pre className="max-h-[min(50vh,480px)] overflow-auto rounded-lg border border-border/40 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-white/80">
                {fullSignalJson}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
