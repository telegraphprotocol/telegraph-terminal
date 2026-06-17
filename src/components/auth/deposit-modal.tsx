"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth";
import { Check, Copy, RefreshCw, X, ArrowDownToLine, ExternalLink, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { INSTANT_WALLET_LABEL } from "@/lib/wallet-labels";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

interface DepositModalProps {
  walletAddress: string;
  connectedUsdcBalance?: string | null;
  onClose: () => void;
}

export function DepositModal({ walletAddress, onClose }: DepositModalProps) {
  const { address: connectedAddress } = useAccount();
  const cardRef = useRef<HTMLDivElement>(null);

  const [privyBalance, setPrivyBalance] = useState<string | null>(null);
  const [refreshingPrivy, setRefreshingPrivy] = useState(false);

  const { data: connectedRaw, refetch: refetchConnected } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!connectedAddress },
  });
  const connectedBalanceNum = connectedRaw !== undefined ? Number(connectedRaw) / 10 ** USDC_DECIMALS : null;

  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const { writeContract, data: txHash, isPending: isSigning, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const fetchPrivyBalance = useCallback(async () => {
    setRefreshingPrivy(true);
    try {
      const res = await fetch("/api/user/wallet", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPrivyBalance(data.usdcBalance ?? "0");
      }
    } finally {
      setRefreshingPrivy(false);
    }
  }, []);

  useEffect(() => { void fetchPrivyBalance(); }, [fetchPrivyBalance]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (isConfirmed) {
      void fetchPrivyBalance();
      void refetchConnected();
      setAmount("");
    }
  }, [isConfirmed, fetchPrivyBalance, refetchConnected]);

  function copyAddress() {
    navigator.clipboard.writeText(walletAddress).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
  }

  function handleMax() {
    if (connectedBalanceNum !== null) setAmount(connectedBalanceNum.toFixed(4));
  }

  function handleTransfer() {
    const parsed = parseFloat(amount);
    if (!parsed || !connectedAddress || parsed <= 0) return;
    resetWrite();
    const rawAmount = BigInt(Math.floor(parsed * 10 ** USDC_DECIMALS));
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [walletAddress as `0x${string}`, rawAmount],
      chainId: baseSepolia.id,
    });
  }

  const parsedAmount = parseFloat(amount);
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0 &&
    (connectedBalanceNum === null || parsedAmount <= connectedBalanceNum);
  const isBusy = isSigning || isConfirming;

  const errorMsg = writeError
    ? (writeError.message.includes("User rejected") || writeError.message.includes("user rejected")
      ? "Transaction rejected in wallet."
      : "Transfer failed. Check your balance and try again.")
    : null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm border border-border/60 bg-card flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center border border-border/60 bg-muted/40">
                <ArrowDownToLine className="size-4 text-foreground/70" />
              </div>
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground">Deposit USDC</h2>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  Base Sepolia testnet · funds your {INSTANT_WALLET_LABEL}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">

            {/* Balance comparison — Instant Wallet (pays for messages) is primary */}
            <div className="grid grid-cols-2 xs:grid-cols-2 gap-2">
              <div className="border-2 border-primary/40 bg-primary/5 p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/70">{INSTANT_WALLET_LABEL}</p>
                  <button
                    onClick={fetchPrivyBalance}
                    disabled={refreshingPrivy}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={cn("size-3", refreshingPrivy && "animate-spin")} />
                  </button>
                </div>
                <p className="text-[15px] font-bold tabular-nums text-foreground">
                  {privyBalance !== null
                    ? `$${Number(privyBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">USDC · pays for messages</p>
              </div>
              <div className="border border-border/40 bg-muted/10 p-3 flex flex-col gap-1.5 opacity-80">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Your Wallet</p>
                <p className="text-[15px] font-bold tabular-nums text-foreground">
                  {connectedBalanceNum !== null
                    ? `$${connectedBalanceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">USDC · source for transfer</p>
              </div>
            </div>

            {/* Amount input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Amount</p>
                {connectedBalanceNum !== null && connectedBalanceNum > 0 && (
                  <button
                    type="button"
                    onClick={handleMax}
                    className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors border border-border/50 px-1.5 py-0.5"
                  >
                    Max
                  </button>
                )}
              </div>
              <div className={cn(
                "flex items-center gap-2 border bg-muted/20 px-3 py-2.5 transition-colors",
                amount && !amountValid && parsedAmount > 0
                  ? "border-destructive/50"
                  : "border-border/60 focus-within:border-foreground/30",
              )}>
                <span className="text-sm font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); resetWrite(); }}
                  className="flex-1 bg-transparent text-sm font-bold text-foreground placeholder:text-muted-foreground/40 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none font-mono"
                />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">USDC</span>
              </div>
              {amount && !amountValid && parsedAmount > 0 && (
                <p className="text-[10px] text-destructive font-mono">Exceeds available balance</p>
              )}
            </div>

            {/* Transfer button */}
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!amountValid || isBusy || isConfirmed}
              className={cn(
                "flex w-full items-center justify-center gap-2 border py-3 text-[11px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
                isConfirmed
                  ? "border-green-500/30 bg-green-500/10 text-green-500"
                  : "border-border/60 bg-muted/30 text-foreground hover:bg-muted/60 hover:border-foreground/30",
              )}
            >
              {isConfirmed ? (
                <><CheckCircle2 className="size-4" />Transfer complete</>
              ) : isSigning ? (
                <><Loader2 className="size-4 animate-spin" />Check your wallet…</>
              ) : isConfirming ? (
                <><Loader2 className="size-4 animate-spin" />Confirming…</>
              ) : (
                <>
                  <span>Transfer to {INSTANT_WALLET_LABEL}</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                <p className="text-[11px] text-destructive font-mono">{errorMsg}</p>
              </div>
            )}

            {/* Tx hash */}
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3" />
                View on BaseScan
              </a>
            )}

            <div className="h-px bg-border/40" />

            {/* Privy address */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Your {INSTANT_WALLET_LABEL} address</p>
              <button
                type="button"
                onClick={copyAddress}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors",
                  copied ? "border-green-500/40 bg-green-500/5" : "border-border/50 bg-muted/20 hover:bg-muted/40",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground truncate">{walletAddress}</span>
                {copied ? <Check className="size-3.5 shrink-0 text-green-500" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </div>

            {/* Faucet link */}
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 border border-border/50 bg-muted/20 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground hover:border-foreground/30"
            >
              <ExternalLink className="size-3" />
              Get testnet USDC — Circle Faucet
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
