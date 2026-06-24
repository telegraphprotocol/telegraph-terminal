"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/lib/auth";
import {
  Check, Copy, RefreshCw, X, ArrowDownToLine, ExternalLink,
  ArrowRight, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC_DECIMALS = 6;

interface SolanaDepositModalProps {
  privySolanaAddress: string;
  onClose: () => void;
}

export function SolanaDepositModal({ privySolanaAddress, onClose }: SolanaDepositModalProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const cardRef = useRef<HTMLDivElement>(null);

  const [privyBalance, setPrivyBalance] = useState<string | null>(null);
  const [connectedBalance, setConnectedBalance] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "signing" | "confirming" | "confirmed" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    setRefreshing(true);
    try {
      const qs = publicKey ? `?externalAddress=${encodeURIComponent(publicKey.toBase58())}` : "";
      const res = await fetch(`/api/user/wallet/solana-balance${qs}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPrivyBalance(data.privySolanaUsdcBalance ?? "0");
        setConnectedBalance(data.externalSolanaUsdcBalance ?? null);
      }
    } finally {
      setRefreshing(false);
    }
  }, [publicKey]);

  useEffect(() => { void fetchBalances(); }, [fetchBalances]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function copyAddress() {
    navigator.clipboard.writeText(privySolanaAddress).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose();
  }

  const connectedBalanceNum = connectedBalance !== null ? Number(connectedBalance) : null;

  function handleMax() {
    if (connectedBalanceNum !== null) setAmount(connectedBalanceNum.toFixed(4));
  }

  async function handleTransfer() {
    const parsed = parseFloat(amount);
    if (!parsed || !publicKey || parsed <= 0) return;
    setTxStatus("signing");
    setErrorMsg(null);
    setTxHash(null);
    try {
      const fromPubkey = publicKey;
      const toPubkey = new PublicKey(privySolanaAddress);
      const rawAmount = Math.floor(parsed * 10 ** USDC_DECIMALS);

      const fromAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, fromPubkey);
      const toAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, toPubkey);

      const tx = new Transaction();

      // Create destination ATA if it doesn't exist
      const toAtaInfo = await connection.getAccountInfo(toAta);
      if (!toAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            fromPubkey,
            toAta,
            toPubkey,
            DEVNET_USDC_MINT,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      tx.add(createTransferInstruction(fromAta, toAta, fromPubkey, rawAmount));

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = fromPubkey;

      setTxStatus("confirming");
      const sig = await sendTransaction(tx, connection);
      setTxHash(sig);

      await connection.confirmTransaction(sig, "confirmed");
      setTxStatus("confirmed");
      void fetchBalances();
      setAmount("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed.";
      const friendly = msg.includes("User rejected") || msg.includes("user rejected")
        ? "Transaction rejected in wallet."
        : "Transfer failed. Check your balance and try again.";
      setErrorMsg(friendly);
      setTxStatus("error");
    }
  }

  const parsedAmount = parseFloat(amount);
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0 &&
    (connectedBalanceNum === null || parsedAmount <= connectedBalanceNum);
  const isBusy = txStatus === "signing" || txStatus === "confirming";

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
                  Solana Devnet · funds your Instant Solana Wallet
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 p-5">

            {/* Balance comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="border-2 border-primary/40 bg-primary/5 p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground/70">Instant Wallet</p>
                  <button onClick={fetchBalances} disabled={refreshing}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                    <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
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
                    : publicKey ? "—" : "Not connected"}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">USDC · source for transfer</p>
              </div>
            </div>

            {!publicKey && (
              <p className="text-[11px] text-amber-400 border border-amber-400/30 bg-amber-400/5 px-3 py-2">
                Connect a Solana wallet (Phantom / Solflare) to deposit.
              </p>
            )}

            {/* Amount input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Amount</p>
                {connectedBalanceNum !== null && connectedBalanceNum > 0 && (
                  <button type="button" onClick={handleMax}
                    className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors border border-border/50 px-1.5 py-0.5">
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
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrorMsg(null); setTxStatus("idle"); }}
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
              disabled={!amountValid || isBusy || txStatus === "confirmed" || !publicKey}
              className={cn(
                "flex w-full items-center justify-center gap-2 border py-3 text-[11px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed",
                txStatus === "confirmed"
                  ? "border-green-500/30 bg-green-500/10 text-green-500"
                  : "border-border/60 bg-muted/30 text-foreground hover:bg-muted/60 hover:border-foreground/30",
              )}
            >
              {txStatus === "confirmed" ? (
                <><CheckCircle2 className="size-4" />Transfer complete</>
              ) : txStatus === "signing" ? (
                <><Loader2 className="size-4 animate-spin" />Check your wallet…</>
              ) : txStatus === "confirming" ? (
                <><Loader2 className="size-4 animate-spin" />Confirming…</>
              ) : (
                <>
                  <span>Transfer to Instant Solana Wallet</span>
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
                href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3" />
                View on Solana Explorer
              </a>
            )}

            <div className="h-px bg-border/40" />

            {/* Privy Solana address */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Your Instant Solana Wallet address</p>
              <button
                type="button"
                onClick={copyAddress}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors",
                  copied ? "border-green-500/40 bg-green-500/5" : "border-border/50 bg-muted/20 hover:bg-muted/40",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground truncate">{privySolanaAddress}</span>
                {copied ? <Check className="size-3.5 shrink-0 text-green-500" /> : <Copy className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            </div>

            {/* Faucet link */}
            <a
              href="https://faucet.solana.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 border border-border/50 bg-muted/20 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground hover:border-foreground/30"
            >
              <ExternalLink className="size-3" />
              Get testnet SOL — Solana Faucet
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
