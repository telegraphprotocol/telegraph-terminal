"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, LogOut, Wallet } from "lucide-react";
import {
  useConnect,
  useConnection,
  useDisconnect,
  useSwitchChain,
  useConnectors,
  useWalletClient,
} from "wagmi";
import { cn } from "@/lib/utils";
import { targetBaseChain } from "@/lib/wagmi-config";
import {
  ensureOnTargetChain,
  formatWalletError,
  isUserRejectedChainError,
} from "@/components/wallet/ensure-base-chain";

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Shorter chip for tight headers (mobile). */
function truncateAddressCompact(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectUiError, setConnectUiError] = useState<string | null>(null);
  const [chainUiError, setChainUiError] = useState<string | null>(null);
  const [chainSwitchSuppressed, setChainSwitchSuppressed] = useState(false);
  const [chainBusy, setChainBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const chainSwitchInFlight = useRef(false);

  const connection = useConnection();
  const connectors = useConnectors();
  const { mutateAsync: connectAsync, isPending: isConnecting, reset: resetConnect } =
    useConnect();
  const { mutateAsync: switchChainAsync } = useSwitchChain();
  const { mutate: disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();

  const isConnected = connection.status === "connected";
  const address = isConnected ? connection.address : undefined;
  const chainId = isConnected ? connection.chainId : undefined;
  const onCorrectChain = chainId === targetBaseChain.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!mounted || !isConnected || !address || chainSwitchSuppressed) return;
    if (chainId === targetBaseChain.id) {
      setChainUiError(null);
      return;
    }
    if (chainSwitchInFlight.current) return;

    let cancelled = false;
    chainSwitchInFlight.current = true;
    (async () => {
      setChainBusy(true);
      setChainUiError(null);
      try {
        await ensureOnTargetChain(switchChainAsync, targetBaseChain.id, walletClient);
      } catch (err) {
        if (cancelled) return;
        if (isUserRejectedChainError(err)) {
          setChainSwitchSuppressed(true);
          setChainUiError("Network switch was cancelled. Use the button below to try again.");
        } else {
          setChainUiError(formatWalletError(err));
        }
      } finally {
        chainSwitchInFlight.current = false;
        if (!cancelled) setChainBusy(false);
      }
    })();

    return () => {
      cancelled = true;
      chainSwitchInFlight.current = false;
    };
  }, [
    mounted,
    isConnected,
    address,
    chainId,
    chainSwitchSuppressed,
    switchChainAsync,
    walletClient,
  ]);

  const hasInjectedProvider =
    mounted &&
    typeof window !== "undefined" &&
    Boolean((window as Window & { ethereum?: unknown }).ethereum);

  const handleConnect = useCallback(async () => {
    setConnectUiError(null);
    resetConnect();
    setChainSwitchSuppressed(false);
    setChainUiError(null);
    const connector = connectors[0];
    if (!connector) {
      setConnectUiError("No wallet connector is available.");
      return;
    }
    try {
      await connectAsync({ connector });
    } catch (err) {
      if (!isUserRejectedChainError(err)) {
        setConnectUiError(formatWalletError(err));
      }
    }
  }, [connectAsync, connectors, resetConnect]);

  const handleManualSwitch = useCallback(async () => {
    if (chainSwitchInFlight.current) return;
    setChainSwitchSuppressed(false);
    setChainUiError(null);
    setChainBusy(true);
    chainSwitchInFlight.current = true;
    try {
      await ensureOnTargetChain(switchChainAsync, targetBaseChain.id, walletClient);
    } catch (err) {
      if (isUserRejectedChainError(err)) {
        setChainSwitchSuppressed(true);
        setChainUiError("Network switch was cancelled.");
      } else {
        setChainUiError(formatWalletError(err));
      }
    } finally {
      chainSwitchInFlight.current = false;
      setChainBusy(false);
    }
  }, [switchChainAsync, walletClient]);

  const handleDisconnect = useCallback(() => {
    setMenuOpen(false);
    setChainSwitchSuppressed(false);
    setChainUiError(null);
    setConnectUiError(null);
    disconnect();
  }, [disconnect]);

  const busy = isConnecting || chainBusy;

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 text-[13px] font-bold text-muted-foreground"
        aria-hidden
      >
        <Wallet size={15} />
        <span className="hidden sm:inline">Connect Wallet</span>
      </button>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-1 self-center">
        <button
          type="button"
          onClick={handleConnect}
          disabled={busy || !hasInjectedProvider}
          title={
            !hasInjectedProvider
              ? "Install a browser wallet (e.g. MetaMask) to connect."
              : undefined
          }
          className={cn(
            "flex h-9 items-center gap-2 rounded-xl border-none bg-gradient-premium px-4 text-[13px] font-bold text-white transition-all duration-300",
            "hover:shadow-[0_0_20px_rgba(140,89,255,0.4)]",
            (busy || !hasInjectedProvider) && "pointer-events-none opacity-60",
          )}
        >
          {isConnecting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Wallet size={15} />
          )}
          <span className="hidden sm:inline">
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </span>
        </button>
        {!hasInjectedProvider ? (
          <p className="max-w-[220px] text-right text-[10px] text-amber-600 dark:text-amber-400">
            No injected wallet detected.
          </p>
        ) : null}
        {connectUiError ? (
          <p className="max-w-[220px] text-right text-[10px] text-red-500">{connectUiError}</p>
        ) : null}
      </div>
    );
  }

  if (!onCorrectChain) {
    return (
      <div className="flex flex-col items-end gap-1 self-center">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleManualSwitch}
            disabled={chainBusy}
            className="flex h-9 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 text-[13px] font-bold text-amber-900 shadow-sm dark:text-amber-100"
          >
            {chainBusy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Wallet size={15} />
            )}
            <span className="hidden sm:inline">
              {chainBusy ? "Switching to Base…" : "Switch to Base"}
            </span>
            <span className="sm:hidden">{chainBusy ? "…" : "Base"}</span>
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={chainBusy}
            className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Disconnect
          </button>
        </div>
        {address ? (
          <p className="max-w-[220px] text-right text-[10px] text-muted-foreground">
            {truncateAddress(address)}
          </p>
        ) : null}
        {chainUiError ? (
          <p className="max-w-[240px] text-right text-[10px] text-red-500">{chainUiError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex min-w-0 flex-col items-center gap-1 self-center" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={busy}
        title={address ?? undefined}
        aria-label={`Wallet menu for ${address}`}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-xl border border-border/50 bg-muted/20 text-left text-[13px] font-bold text-foreground transition-all duration-300 hover:bg-muted/40",
          "max-w-[min(9.5rem,calc(100vw-7rem))] px-2 sm:max-w-[min(11.5rem,calc(100vw-8rem))] sm:gap-2 sm:px-3 lg:max-w-[min(200px,calc(100vw-8rem))]",
        )}
      >
        <Wallet size={15} className="shrink-0" />
        <span className="min-w-0 truncate lg:hidden">{truncateAddressCompact(address!)}</span>
        <span className="hidden min-w-0 truncate lg:inline">{truncateAddress(address!)}</span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] rounded-xl border border-border/60 bg-popover py-1 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-foreground hover:bg-accent"
          >
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
