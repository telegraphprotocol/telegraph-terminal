"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, RefreshCw, LogOut, Wallet, ArrowDownToLine, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { cn } from "@/lib/utils";
import { authHeaders, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DepositModal } from "@/components/auth/deposit-modal";

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
  walletMode?: "privy" | "external" | null;
};

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function chainLabel(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

function formatUsd(usdcBalance: string | undefined): string {
  if (usdcBalance == null || usdcBalance === "") return "$—";
  const n = Number(usdcBalance);
  if (!Number.isFinite(n)) return "$—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
    </button>
  );
}

function AddressRow({ label, address, badge }: { label: string; address: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        {badge && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] leading-none">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
        <span className="font-mono text-[11px] text-foreground" title={address}>
          {truncateAddress(address)}
        </span>
        <CopyButton text={address} />
      </div>
    </div>
  );
}

function WalletModal({
  data,
  loading,
  error,
  connectedAddress,
  connectedUsdcBalance,
  anchorRect,
  onRefresh,
  onDeposit,
  onDisconnect,
  onClose,
}: {
  data: CoreWalletPayload | null;
  loading: boolean;
  error: string | null;
  connectedAddress: string | undefined;
  connectedUsdcBalance: string | null;
  anchorRect: DOMRect;
  onRefresh: () => void;
  onDeposit: () => void;
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const isPrivy = data?.walletMode === "privy";
  const isExternal = data?.walletMode === "external";

  const top = anchorRect.bottom + 8;
  const right = window.innerWidth - anchorRect.right;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: -6 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{ top, right }}
      className="fixed z-[9999] w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-border bg-card p-5 shadow-2xl shadow-black/20 flex flex-col gap-4"
    >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="size-3.5 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <Separator />

        {/* Connected wallet */}
        {connectedAddress && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Connected Wallet
            </p>
            <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2">
              <AddressRow label="Address" address={connectedAddress} badge="External" />
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground">USDC balance</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {connectedUsdcBalance !== null ? formatUsd(connectedUsdcBalance) : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment wallet */}
        {loading && !data ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" />
            Loading wallet…
          </div>
        ) : error && !data ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</p>
        ) : data ? (
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Payment Wallet
            </p>

            <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2">
              {isPrivy && (
                <AddressRow
                  label="Privy wallet address"
                  address={data.address}
                  badge="Privy"
                />
              )}

              {isExternal && connectedAddress && (
                <p className="text-[11px] text-muted-foreground">
                  Using your connected wallet for payments.
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    USDC balance{data.chainId ? ` · ${chainLabel(data.chainId)}` : ""}
                  </span>
                  <span className={cn("text-sm font-bold tabular-nums", loading ? "opacity-50 text-foreground" : "text-foreground")}>
                    {formatUsd(data.usdcBalance)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  title="Refresh balance"
                >
                  <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                </button>
              </div>
            </div>

            {error && data && (
              <p className="text-[11px] text-amber-500">Could not refresh: {error}</p>
            )}
          </div>
        ) : null}

        <Separator />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {isPrivy && (
            <button
              type="button"
              onClick={onDeposit}
              className="group flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-left transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <ArrowDownToLine className="size-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-none">Deposit USDC</p>
                <p className="text-[10px] text-white/70 mt-0.5">Fund your Privy wallet</p>
              </div>
              <ChevronRight className="size-3.5 text-white/60 group-hover:text-white transition-colors" />
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDisconnect}
          >
            <LogOut className="size-3.5" />
            Disconnect
          </Button>
        </div>
    </motion.div>,
    document.body,
  );
}

export function GlobalWallet({ className }: Readonly<{ className?: string }>) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [data, setData] = useState<CoreWalletPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const { address: connectedAddress } = useAccount();

  const { data: connectedUsdcRaw, refetch: refetchConnectedUsdc } = useReadContract({
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!connectedAddress },
  });
  const connectedUsdcBalance = connectedAddress && connectedUsdcRaw !== undefined
    ? (Number(connectedUsdcRaw) / 1e6).toString()
    : null;
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/wallet", { cache: "no-store", headers: authHeaders() });
      if (res.status === 401) { setData(null); return; }
      const text = await res.text();
      if (!res.ok) { setError(text.slice(0, 200) || `HTTP ${res.status}`); return; }
      setData(JSON.parse(text) as CoreWalletPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (open) {
      void load();
      void refetchConnectedUsdc();
    }
  }, [open, load, refetchConnectedUsdc]);


  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onDisconnect = () => {
    clearToken();
    setData(null);
    setOpen(false);
    window.location.reload();
  };

  const triggerLabel = loading && !data
    ? "…"
    : data?.usdcBalance != null
      ? formatUsd(data.usdcBalance)
      : connectedAddress
        ? truncateAddress(connectedAddress)
        : "Wallet";

  return (
    <>
      <div ref={rootRef} className={cn("relative shrink-0", className)}>
        <button
          type="button"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setAnchorRect(rect);
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Open wallet"
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium transition-colors",
            "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
        >
          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Wallet className="size-3 text-primary" />
          </div>
          <span className="tabular-nums text-foreground">{triggerLabel}</span>
          {loading && data && (
            <RefreshCw className="size-3 shrink-0 animate-spin text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {open && anchorRect && (
            <WalletModal
              data={data}
              loading={loading}
              error={error}
              connectedAddress={connectedAddress}
              connectedUsdcBalance={connectedUsdcBalance}
              anchorRect={anchorRect}
              onRefresh={() => void load()}
              onDeposit={() => { setOpen(false); setDepositOpen(true); }}
              onDisconnect={onDisconnect}
              onClose={() => setOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {depositOpen && data?.address && data.walletMode === "privy" && (
        <DepositModal
          walletAddress={data.address}
          connectedUsdcBalance={connectedUsdcBalance}
          onClose={() => setDepositOpen(false)}
        />
      )}
    </>
  );
}
