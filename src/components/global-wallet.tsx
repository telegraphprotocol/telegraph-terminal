"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
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

export function GlobalWallet({ className }: Readonly<{ className?: string }>) {
  const [revealed, setRevealed] = useState<boolean | null>(null);
  const [data, setData] = useState<CoreWalletPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/core/wallet", { cache: "no-store" });
      const text = await res.text();
      if (!res.ok) {
        setData(null);
        setError(text.slice(0, 200) || `HTTP ${res.status}`);
        return;
      }
      const json = JSON.parse(text) as CoreWalletPayload;
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Wallet load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    const ok = localStorage.getItem(STORAGE_KEY) === "1";
    setRevealed(ok);
    if (ok) {
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    if (revealed !== true) return;
    void load();
  }, [revealed, load]);

  const onReveal = () => {
    setLoading(true);
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
          Top up wallet
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)} aria-live="polite">
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("text-xs text-amber-200/90", className)} title={error ?? undefined}>
        Wallet unavailable
      </div>
    );
  }

  const ethDisplay = Number(data.nativeBalanceFormatted).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
  const usdcDisplay =
    data.usdcBalance == null
      ? "—"
      : Number(data.usdcBalance).toLocaleString(undefined, { maximumFractionDigits: 6 });

  return (
    <div
      className={cn(
        "flex max-w-[min(100%,18rem)] flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs",
        className,
      )}
    >
      <div className="flex justify-between gap-2 text-[11px] leading-tight">
        <span className="shrink-0 text-muted-foreground">Chain</span>
        <span className="min-w-0 truncate text-right text-foreground" title={String(data.chainId)}>
          {chainLabel(data.chainId)}
        </span>
      </div>
      <div className="flex justify-between gap-2 text-[11px] leading-tight">
        <span className="shrink-0 text-muted-foreground">Address</span>
        <span
          className="min-w-0 truncate font-mono text-right text-foreground"
          title={data.address}
        >
          {truncateAddress(data.address)}
        </span>
      </div>
      <div className="flex justify-between gap-2 text-[11px] leading-tight">
        <span className="shrink-0 text-muted-foreground">ETH</span>
        <span className="min-w-0 truncate text-right tabular-nums text-foreground">{ethDisplay}</span>
      </div>
      <div className="flex justify-between gap-2 text-[11px] leading-tight">
        <span className="shrink-0 text-muted-foreground">USDC</span>
        <span className="min-w-0 truncate text-right tabular-nums text-foreground">{usdcDisplay}</span>
      </div>
      <button
        type="button"
        onClick={() => void load()}
        className="self-start text-[11px] text-primary underline-offset-2 hover:underline"
      >
        Refresh
      </button>
    </div>
  );
}
