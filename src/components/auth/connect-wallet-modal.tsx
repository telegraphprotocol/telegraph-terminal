"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount, useSignMessage, useConnect, useDisconnect } from "wagmi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { setToken } from "@/lib/auth";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface ConnectWalletModalProps {
  onAuthenticated: () => void;
}

type Step = "connect" | "sign" | "verifying" | "error";

export function ConnectWalletModal({ onAuthenticated }: ConnectWalletModalProps) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [step, setStep] = useState<Step>("connect");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSign = useCallback(async () => {
    if (!address) return;
    setStep("sign");
    setErrorMsg(null);

    try {
      // 1. Get nonce + message from backend
      const nonceRes = await fetch(`/api/auth/nonce?address=${encodeURIComponent(address)}`);
      if (!nonceRes.ok) throw new Error("Failed to fetch nonce");
      const { message } = await nonceRes.json();

      // 2. Sign with connected wallet
      const signature = await signMessageAsync({ message });

      setStep("verifying");

      // 3. Verify signature → JWT
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body.message ?? "Verification failed");
      }
      const { token } = await verifyRes.json();
      setToken(token);
      onAuthenticated();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }, [address, signMessageAsync, onAuthenticated]);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div
        className={cn(
          "w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl",
          "flex flex-col gap-5",
        )}
      >
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Connect your wallet</h2>
          <p className="text-xs text-muted-foreground">
            Sign a message to authenticate. No gas fees, no blockchain transaction.
          </p>
        </div>

        <Separator />

        {/* Step: connect */}
        {(!isConnected || step === "connect" || step === "error") && !isConnected && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">Step 1 — Connect a wallet</p>
            <ConnectButton
              label="Connect Wallet"
              showBalance={false}
              chainStatus="none"
            />
          </div>
        )}

        {/* Step: sign */}
        {isConnected && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Connected</p>
              <p className="font-mono text-xs text-foreground">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </p>
            </div>

            {step === "error" && errorMsg && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </p>
            )}

            <Button
              onClick={handleSign}
              disabled={step === "sign" || step === "verifying"}
              className="w-full"
            >
              {step === "sign"
                ? "Check your wallet…"
                : step === "verifying"
                  ? "Verifying…"
                  : step === "error"
                    ? "Retry"
                    : "Sign to authenticate"}
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Base Sepolia · This signature only proves wallet ownership
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
