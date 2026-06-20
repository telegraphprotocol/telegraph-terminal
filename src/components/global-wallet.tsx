"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, RefreshCw, LogOut, Wallet, ArrowDownToLine, X, ExternalLink, Info } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useDisconnect, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { cn } from "@/lib/utils";
import { authHeaders, clearToken } from "@/lib/auth";
import { DepositModal } from "@/components/auth/deposit-modal";
import { ConnectWalletModal } from "@/components/auth/connect-wallet-modal";
import { INSTANT_WALLET_LABEL, CONNECTED_WALLET_LABEL } from "@/lib/wallet-labels";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  /** Which wallet is actually debited for payments. Falls back to walletMode if absent. */
  activeForPayments?: "privy" | "external";
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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
        {badge && (
          <span className="border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground leading-none">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border border-border/50 bg-muted/30 px-2.5 py-2">
        <span className="font-mono text-[11px] text-foreground" title={address}>
          {truncateAddress(address)}
        </span>
        <CopyButton text={address} />
      </div>
    </div>
  );
}

function SectionLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-px bg-foreground/40" />
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</p>
      {tooltip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info size={14} className="text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px] text-[11px] leading-relaxed border border-border/60 bg-card text-foreground shadow-xl backdrop-blur-md">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

/** Secondary wallet box — amber toned to distinguish from the primary payment wallet. */
function SecondaryWalletBox({
  label,
  address,
  usdcBalance,
}: {
  label: string;
  address: string;
  usdcBalance: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel tooltip="This is your external wallet (e.g. MetaMask). It is not used for payments directly. Use it to deposit USDC into your Telegraph Instant Wallet to fund miner calls.">
        {label}
      </SectionLabel>
      <div className="border-2 border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-3">
        <AddressRow label="Address" address={address} badge="Connected" />
        <div className="flex items-center justify-between border-t border-amber-500/20 pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">USDC · Base Sepolia</span>
            <span className="text-[15px] font-bold tabular-nums text-foreground">
              {usdcBalance !== null ? formatUsd(usdcBalance) : "—"}
            </span>
          </div>
        </div>
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
  const activeMode = data?.activeForPayments ?? (data?.walletMode === "privy" ? "privy" : "external");
  const isPrivy = activeMode === "privy";

  const top = anchorRect.bottom + 8;
  const right = Math.max(8, window.innerWidth - anchorRect.right);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      style={{ top, right }}
      className="fixed z-[9999] w-[min(calc(100vw-1rem),22rem)] border border-border/60 bg-card/95 backdrop-blur-[14px] shadow-2xl shadow-black/30 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 shrink-0 items-center justify-center border border-border/60 bg-muted/40">
            <Wallet className="size-3 text-foreground/70" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">Account</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">

        {/* Primary wallet — whichever one is actually debited for payments */}
        {loading && !data ? (
          <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" />
            Loading wallet…
          </div>
        ) : error && !data ? (
          <p className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{error}</p>
        ) : data ? (
          <div className="flex flex-col gap-2">
            <SectionLabel
              tooltip={isPrivy
                ? "This is your Telegraph Instant Wallet, powered by Privy. All miner payments are deducted from here. Deposit USDC into this wallet from your connected external wallet."
                : "Your connected external wallet is used directly for payments. Each miner call requires a signature approval from this wallet."}
            >
              {isPrivy ? INSTANT_WALLET_LABEL : CONNECTED_WALLET_LABEL}
            </SectionLabel>
            <div className="border-2 border-primary/30 bg-primary/5 p-3 flex flex-col gap-3">
              <AddressRow
                label="Address"
                address={isPrivy ? data.address : connectedAddress ?? data.address}
                badge={isPrivy ? "Instant" : "Connected"}
              />
              <div className="flex items-center justify-between border-t border-primary/20 pt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    USDC{data.chainId ? ` · ${chainLabel(data.chainId)}` : ""}
                  </span>
                  <span className={cn("text-[15px] font-bold tabular-nums text-foreground", loading && "opacity-50")}>
                    {formatUsd(isPrivy ? data.usdcBalance : connectedAddress ? connectedUsdcBalance ?? undefined : data.usdcBalance)}
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
              <p className="text-[10px] text-amber-500 font-mono">Could not refresh: {error}</p>
            )}
          </div>
        ) : null}

        {/* Secondary wallet — connected-but-unused */}
        {isPrivy && connectedAddress && (
          <SecondaryWalletBox
            label={CONNECTED_WALLET_LABEL}
            address={connectedAddress}
            usdcBalance={connectedUsdcBalance}
          />
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
          {isPrivy && (
            <button
              type="button"
              onClick={onDeposit}
              className="group flex w-full items-center gap-3 border border-border/60 bg-muted/30 px-3 py-2.5 text-left transition-all hover:bg-muted/60 hover:border-foreground/30 active:scale-[0.98]"
            >
              <ArrowDownToLine className="size-4 text-foreground/60 shrink-0 group-hover:text-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-foreground leading-none">Deposit USDC</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">Fund your {INSTANT_WALLET_LABEL}</p>
              </div>
            </button>
          )}
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-full items-center gap-3 border-2 border-sky-500/40 bg-sky-500/8 px-3 py-2.5 text-left transition-all hover:border-sky-500/70 hover:bg-sky-500/15 active:scale-[0.98]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-sky-400 leading-none group-hover:text-sky-300">Get Free Test USDC</p>
              <p className="text-[10px] text-sky-400/50 mt-0.5">Circle Faucet · Base Sepolia</p>
            </div>
            <ExternalLink className="size-3.5 shrink-0 text-sky-400/50 group-hover:text-sky-300 transition-colors" />
          </a>
          <button
            type="button"
            onClick={onDisconnect}
            className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-destructive/70 hover:text-destructive transition-colors hover:bg-destructive/5 border border-transparent hover:border-destructive/20"
          >
            <LogOut className="size-3.5" />
            Disconnect
          </button>
        </div>
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const { address: connectedAddress } = useAccount();
  const { disconnect } = useDisconnect();

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
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (open) {
      void load();
      void refetchConnectedUsdc();
    }
  }, [open, load, refetchConnectedUsdc]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const onDisconnect = () => {
    disconnect();
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

  // Not yet signed in — show a connect button
  if (hasLoaded && !data) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 border border-foreground/50 bg-foreground/10 px-2.5 sm:px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors",
            "hover:border-foreground/80 hover:bg-foreground/20 focus:outline-none",
            className,
          )}
        >
          <Wallet className="size-3 shrink-0" />
          <span>Connect Wallet</span>
        </button>
        {connectOpen && (
          <ConnectWalletModal
            onAuthenticated={() => { setConnectOpen(false); void load(); }}
            onClose={() => setConnectOpen(false)}
          />
        )}
      </>
    );
  }

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
            "flex h-8 items-center gap-2 border border-border/60 px-3 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors",
            "hover:border-foreground/30 hover:text-foreground focus:outline-none",
            open && "border-foreground/30",
          )}
        >
          <Wallet className="size-3 text-foreground/60 shrink-0" />
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
