"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "telegraph_terminal_wallet_revealed";

const CHAIN_NAMES: Record<number, string> = {
  84532: "Base Sepolia",
  8453: "Base",
  137: "Polygon",
  1: "Ethereum",
};

export type CoreWalletPayload = {
  address: string;
  chainId: number;
  nativeBalanceFormatted: string;
  usdcBalance?: string;
  usdcDecimals?: number;
};

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function chainLabel(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

function formatUsdcBalance(d: CoreWalletPayload): string {
  if (d.usdcBalance == null) return "—";
  return Number(d.usdcBalance).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

/** USDC amount as USD for compact trigger label (API returns decimal string). */
function formatUsdcTriggerLabel(usdcBalance: string | undefined): string {
  if (usdcBalance == null || usdcBalance === "") return "$—";
  const n = Number(usdcBalance);
  if (!Number.isFinite(n)) return "$—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 6,
  });
}

function GlobalWalletPanel({
  loading,
  data,
  error,
  onRefresh,
}: Readonly<{
  loading: boolean;
  data: CoreWalletPayload | null;
  error: string | null;
  onRefresh: () => void;
}>) {
  let errorText: string | null = null;
  if (error) {
    errorText = data ? `Could not refresh: ${error}` : error;
  }
  const showUnavailable = !data && !loading && !error;
  const ethDisplay = data
    ? Number(data.nativeBalanceFormatted).toLocaleString(undefined, {
        maximumFractionDigits: 6,
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-label="Wallet details"
      className={cn(
        "absolute top-[calc(100%+8px)] right-0 z-50 min-w-[min(100vw-2rem,20rem)] max-w-[min(90vw,28rem)] rounded-2xl border border-border/50 bg-popover/95 p-3 text-xs shadow-2xl shadow-primary/10 backdrop-blur-xl",
      )}
    >
      {loading && !data ? (
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          Loading…
        </p>
      ) : null}

      {errorText ? (
        <p className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">{errorText}</p>
      ) : null}

      {data ? (
        <div
          className={cn(
            "flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-[11px] leading-snug",
            loading ? "opacity-70" : null,
          )}
        >
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-muted-foreground">Chain</span>
            <span className="text-foreground" title={String(data.chainId)}>
              {chainLabel(data.chainId)}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-muted-foreground">Address</span>
            <span className="font-mono text-foreground" title={data.address}>
              {truncateAddress(data.address)}
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-muted-foreground">ETH</span>
            <span className="tabular-nums text-foreground">{ethDisplay}</span>
          </span>
          <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-muted-foreground">USDC</span>
            <span className="tabular-nums text-foreground">{formatUsdcBalance(data)}</span>
          </span>
        </div>
      ) : null}

      {showUnavailable ? (
        <p className="text-[11px] text-muted-foreground">Wallet unavailable</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onRefresh}
          className="text-[11px] text-primary underline-offset-2 hover:underline"
        >
          Refresh
        </button>
        <button
          type="button"
          className="text-[11px] text-primary underline-offset-2 hover:underline"
        >
          Top up
        </button>
      </div>
    </motion.div>
  );
}

export function GlobalWallet({ className }: Readonly<{ className?: string }>) {
  const [revealed, setRevealed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CoreWalletPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/core/wallet", { cache: "no-store" });
      const text = await res.text();
      if (!res.ok) {
        setError(text.slice(0, 200) || `HTTP ${res.status}`);
        return;
      }
      const json = JSON.parse(text) as CoreWalletPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    const ok = localStorage.getItem(STORAGE_KEY) === "1";
    setRevealed(ok);
  }, []);

  useEffect(() => {
    if (revealed !== true) return;
    void load();
  }, [revealed, load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onReveal = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setRevealed(true);
  };

  if (revealed === null) {
    return (
      <div
        className={cn("h-8 min-w-[7.5rem] rounded-md border border-transparent", className)}
        aria-hidden
      />
    );
  }

  if (revealed === false) {
    return (
      <div className={cn("flex shrink-0", className)}>
        <button
          type="button"
          onClick={onReveal}
          className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          Top up
        </button>
      </div>
    );
  }

  let triggerTitle: string | undefined;
  if (error) {
    triggerTitle = error;
  } else if (data) {
    triggerTitle = `${truncateAddress(data.address)} · ${chainLabel(data.chainId)} · USDC ${formatUsdcBalance(data)}`;
  }

  let triggerLabel: string;
  if (error && !data) {
    triggerLabel = "Wallet";
  } else if (loading && !data) {
    triggerLabel = "…";
  } else {
    triggerLabel = formatUsdcTriggerLabel(data?.usdcBalance);
  }

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Global wallet"
        aria-busy={loading}
        title={triggerTitle}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-left text-[13px] font-medium transition-colors",
          "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          error && !data ? "border-amber-500/40 bg-amber-500/5" : null,
        )}
      >
        <span className="tabular-nums text-foreground">{triggerLabel}</span>
        {loading && data ? (
          <span className="text-[10px] font-normal text-muted-foreground" aria-live="polite">
            …
          </span>
        ) : null}
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <AnimatePresence>
        {open ? (
          <GlobalWalletPanel
            loading={loading}
            data={data}
            error={error}
            onRefresh={() => void load()}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
