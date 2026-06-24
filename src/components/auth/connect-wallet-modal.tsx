"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useSignMessage } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { setToken } from "@/lib/auth";
import { usePaymentNetwork } from "@/lib/network-context";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import bs58 from "bs58";

function readSessionToken(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const token = rec.token ?? rec.accessToken;
  return typeof token === "string" && token.trim().length > 0 ? token : null;
}

interface ConnectWalletModalProps {
  onAuthenticated: () => void;
  onClose?: () => void;
}

type SignStep = "idle" | "sign" | "verifying" | "error";

export function ConnectWalletModal({ onAuthenticated, onClose }: ConnectWalletModalProps) {
  const { setNetwork } = usePaymentNetwork();

  // EVM
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Solana
  const {
    publicKey: solanaPubkey,
    signMessage: solanaSignMessage,
    connected: solanaConnected,
    connect: solanaConnect,
    wallet: solanaWallet,
    connecting: solanaConnecting,
  } = useWallet();
  const { visible: adapterModalVisible, setVisible: openAdapterModal } = useWalletModal();

  const [evmStep, setEvmStep] = useState<SignStep>("idle");
  const [solanaStep, setSolanaStep] = useState<SignStep>("idle");
  const [evmError, setEvmError] = useState<string | null>(null);
  const [solanaError, setSolanaError] = useState<string | null>(null);

  const handleEvmSign = useCallback(async () => {
    if (!evmAddress) return;
    setEvmStep("sign");
    setEvmError(null);
    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${encodeURIComponent(evmAddress)}`);
      if (!nonceRes.ok) throw new Error("Unable to connect. Please try again.");
      const { message } = await nonceRes.json();
      const signature = await signMessageAsync({ message });
      setEvmStep("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: evmAddress, signature }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.message ?? "Wallet verification failed. Please try again.");
      }
      const verifyBody = await verifyRes.json();
      const token = readSessionToken(verifyBody);
      if (!token) throw new Error("Authentication succeeded but no session token was returned.");
      setNetwork("base-sepolia");
      setToken(token);
      setEvmStep("idle");
      onAuthenticated();
    } catch (err) {
      setEvmError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setEvmStep("error");
    }
  }, [evmAddress, signMessageAsync, onAuthenticated, setNetwork]);

  const handleSolanaSign = useCallback(async () => {
    if (!solanaPubkey || !solanaSignMessage) {
      if (solanaConnected && !solanaSignMessage) {
        setSolanaError("This wallet does not support message signing. Try Phantom or Solflare.");
        setSolanaStep("error");
      }
      return;
    }
    setSolanaStep("sign");
    setSolanaError(null);
    try {
      const address = solanaPubkey.toBase58();
      const nonceRes = await fetch(`/api/auth/nonce?address=${encodeURIComponent(address)}`);
      if (!nonceRes.ok) throw new Error("Unable to connect. Please try again.");
      const { message } = await nonceRes.json();
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await solanaSignMessage(msgBytes);
      const signature = bs58.encode(sigBytes);
      setSolanaStep("verifying");
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.message ?? "Wallet verification failed. Please try again.");
      }
      const verifyBody = await verifyRes.json();
      const token = readSessionToken(verifyBody);
      if (!token) throw new Error("Authentication succeeded but no session token was returned.");
      setNetwork("solana");
      setToken(token);
      setSolanaStep("idle");
      onAuthenticated();
    } catch (err) {
      setSolanaError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSolanaStep("error");
    }
  }, [solanaPubkey, solanaSignMessage, solanaConnected, onAuthenticated, setNetwork]);

  // Wallet adapter modal only calls select() — with autoConnect=false we must connect explicitly.
  useEffect(() => {
    if (!solanaWallet || solanaConnected || solanaConnecting || adapterModalVisible) return;
    void solanaConnect().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to connect Solana wallet";
      setSolanaError(msg);
      setSolanaStep("error");
    });
  }, [solanaWallet, solanaConnected, solanaConnecting, adapterModalVisible, solanaConnect]);

  // Auto-sign on connect
  const evmAutoAttempted = useRef(false);
  const solanaAutoAttempted = useRef(false);
  useEffect(() => {
    if (evmConnected) {
      setNetwork("base-sepolia");
    }
    if (evmConnected && evmStep === "idle" && !evmAutoAttempted.current) {
      evmAutoAttempted.current = true;
      void handleEvmSign();
    }
    if (!evmConnected) evmAutoAttempted.current = false;
  }, [evmConnected, evmStep, handleEvmSign, setNetwork]);
  useEffect(() => {
    if (solanaConnected) {
      setNetwork("solana");
    }
    if (solanaConnected && solanaStep === "idle" && !solanaAutoAttempted.current) {
      solanaAutoAttempted.current = true;
      void handleSolanaSign();
    }
    if (!solanaConnected) solanaAutoAttempted.current = false;
  }, [solanaConnected, solanaStep, handleSolanaSign, setNetwork]);

  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        adapterModalVisible ? "z-[1] pointer-events-none" : "z-[9999]",
      )}
      onClick={(e) => { if (onClose && e.target === e.currentTarget && !adapterModalVisible) onClose(); }}
    >
      <div className={cn(
        "w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl flex flex-col gap-5",
        adapterModalVisible ? "pointer-events-none opacity-0" : "pointer-events-auto",
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">Connect your wallet</h2>
            <p className="text-xs text-muted-foreground">
              Sign a message to authenticate — no gas fees, no transaction.
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          {/* EVM — Base Sepolia */}
          <div className={cn(
            "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
            evmConnected ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/10",
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Base Sepolia</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">EVM</span>
            </div>
            {evmConnected && evmAddress ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-xs text-muted-foreground">
                  {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
                </p>
                {evmStep === "error" && evmError && (
                  <p className="rounded bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{evmError}</p>
                )}
                <Button size="sm" onClick={handleEvmSign}
                  disabled={evmStep === "sign" || evmStep === "verifying"}
                  className="w-full"
                >
                  {evmStep === "sign" ? "Check your wallet…"
                    : evmStep === "verifying" ? "Verifying…"
                    : evmStep === "error" ? "Retry"
                    : "Sign to authenticate"}
                </Button>
              </div>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button size="sm" variant="outline" onClick={openConnectModal} className="w-full">
                    Connect EVM Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            )}
          </div>

          {/* Solana Devnet */}
          <div className={cn(
            "flex flex-col gap-3 rounded-lg border p-4 transition-colors",
            solanaConnected ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/10",
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Solana Devnet</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">SOL</span>
            </div>
            {solanaConnected && solanaPubkey ? (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-xs text-muted-foreground">
                  {solanaPubkey.toBase58().slice(0, 6)}…{solanaPubkey.toBase58().slice(-4)}
                </p>
                {solanaStep === "error" && solanaError && (
                  <p className="rounded bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{solanaError}</p>
                )}
                <Button size="sm" onClick={handleSolanaSign}
                  disabled={solanaStep === "sign" || solanaStep === "verifying"}
                  className="w-full"
                >
                  {solanaStep === "sign" ? "Check your wallet…"
                    : solanaStep === "verifying" ? "Verifying…"
                    : solanaStep === "error" ? "Retry"
                    : "Sign to authenticate"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => openAdapterModal(true)} className="w-full">
                Connect Solana Wallet
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
