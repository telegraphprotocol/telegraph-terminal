"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth";
import { Check, Copy, RefreshCw, X, ArrowDownToLine, ExternalLink, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { baseSepolia } from "wagmi/chains";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

function formatUsdc(raw: bigint | undefined): string {
  if (raw === undefined) return "—";
  return (Number(raw) / 10 ** USDC_DECIMALS).toLocaleString("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4,
  });
}

interface DepositModalProps {
  walletAddress: string;
  connectedUsdcBalance?: string | null;
  onClose: () => void;
}

export function DepositModal({ walletAddress, onClose }: DepositModalProps) {
  const { address: connectedAddress } = useAccount();
  const cardRef = useRef<HTMLDivElement>(null);

  // Privy wallet balance (from backend)
  const [privyBalance, setPrivyBalance] = useState<string | null>(null);
  const [refreshingPrivy, setRefreshingPrivy] = useState(false);

  // Connected wallet USDC balance (on-chain)
  const { data: connectedRaw, refetch: refetchConnected } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: baseSepolia.id,
    query: { enabled: !!connectedAddress },
  });
  const connectedBalanceNum = connectedRaw !== undefined ? Number(connectedRaw) / 10 ** USDC_DECIMALS : null;

  // Transfer state
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

  // After confirmed, refresh both balances and reset form
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
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                <ArrowDownToLine className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Deposit USDC</h2>
                <p className="text-[11px] text-muted-foreground">Base Sepolia testnet</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="h-px bg-border/50" />

          <div className="flex flex-col gap-4 p-5">

            {/* Balance comparison row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 flex flex-col gap-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Connected</p>
                <p className="text-base font-bold tabular-nums text-foreground">
                  {connectedBalanceNum !== null
                    ? `$${connectedBalanceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">USDC</p>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-primary/70 font-medium">Privy Wallet</p>
                  <button
                    onClick={fetchPrivyBalance}
                    disabled={refreshingPrivy}
                    className="text-primary/50 hover:text-primary transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={cn("size-3", refreshingPrivy && "animate-spin")} />
                  </button>
                </div>
                <p className={cn("text-base font-bold tabular-nums", privyBalance !== null ? "text-foreground" : "text-muted-foreground")}>
                  {privyBalance !== null
                    ? `$${Number(privyBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </p>
                <p className="text-[10px] text-primary/60">USDC</p>
              </div>
            </div>

            {/* Transfer input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-muted-foreground">Amount to transfer</p>
                {connectedBalanceNum !== null && connectedBalanceNum > 0 && (
                  <button
                    type="button"
                    onClick={handleMax}
                    className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    MAX
                  </button>
                )}
              </div>
              <div className={cn(
                "flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2.5 transition-colors",
                amount && !amountValid && parsedAmount > 0
                  ? "border-destructive/50"
                  : "border-border/60 focus-within:border-primary/50",
              )}>
                <span className="text-sm font-medium text-muted-foreground">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); resetWrite(); }}
                  className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] font-medium text-muted-foreground shrink-0">USDC</span>
              </div>
              {amount && !amountValid && parsedAmount > 0 && (
                <p className="text-[10px] text-destructive">Exceeds available balance</p>
              )}
            </div>

            {/* Transfer button */}
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!amountValid || isBusy || isConfirmed}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]",
                isConfirmed
                  ? "bg-green-500/15 text-green-400 border border-green-500/30"
                  : "bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
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
                  <span>Transfer to Privy Wallet</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <AlertCircle className="size-3.5 shrink-0 text-destructive" />
                <p className="text-[11px] text-destructive">{errorMsg}</p>
              </div>
            )}

            {/* Tx hash link */}
            {txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3" />
                View on BaseScan
              </a>
            )}

            <div className="h-px bg-border/40" />

            {/* Privy address + faucet */}
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium text-muted-foreground">Your Privy wallet address</p>
              <button
                type="button"
                onClick={copyAddress}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                  copied ? "border-green-500/40 bg-green-500/5" : "border-border/60 bg-muted/20 hover:bg-muted/40",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground truncate">{walletAddress}</span>
                {copied ? <Check className="size-3.5 shrink-0 text-green-500" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </div>

            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-muted/20 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
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
