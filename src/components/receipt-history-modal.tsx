"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { StoredReceipt } from "@/lib/mock-data";

type ApiReceipt = StoredReceipt & {
  _id: string;
  createdAt: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ReceiptCard({ receipt }: { receipt: ApiReceipt }) {
  const [copied, setCopied] = useState(false);

  function copyHash() {
    if (!receipt.x402TxHash) return;
    void navigator.clipboard.writeText(receipt.x402TxHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-foreground truncate">
            {receipt.subnet}
          </p>
          <p className="text-[11px] text-muted-foreground">
            SN{receipt.subnetId}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-bold tabular-nums text-foreground">
            ${receipt.costUsd.toFixed(4)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(receipt.createdAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {receipt.x402Network && (
          <span className="rounded border border-border/50 px-1.5 py-0.5 font-mono uppercase tracking-wide">
            {receipt.x402Network}
          </span>
        )}
        <span>{receipt.durationMs}ms</span>
        {receipt.intent && (
          <span className="truncate italic">{receipt.intent}</span>
        )}
      </div>

      {receipt.x402TxHash && (
        <div className="flex items-center gap-2 border-t border-border/30 pt-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
            {receipt.x402TxHash.slice(0, 12)}…{receipt.x402TxHash.slice(-8)}
          </span>
          <button
            type="button"
            onClick={copyHash}
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Copy tx hash"
          >
            {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
          </button>
          {receipt.x402ExplorerUrl && (
            <a
              href={receipt.x402ExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="View on explorer"
            >
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function ReceiptHistoryModal({ onClose }: { onClose: () => void }) {
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/receipts", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ApiReceipt[]) => setReceipts(data))
      .catch(() => setReceipts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt history"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border/60 bg-card shadow-2xl sm:rounded-2xl" style={{ maxHeight: "90dvh" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-[14px] font-bold uppercase tracking-[0.08em] text-foreground sm:text-[15px]">
            Receipt History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-3">
            {loading ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">Loading receipts…</p>
            ) : receipts.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                No receipts yet — paid messages will appear here.
              </p>
            ) : (
              receipts.map((r) => <ReceiptCard key={r._id} receipt={r} />)
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
