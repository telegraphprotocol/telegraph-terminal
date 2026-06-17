"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { authHeaders } from "@/lib/auth";
import { INSTANT_WALLET_LABEL, CONNECTED_WALLET_LABEL } from "@/lib/wallet-labels";

interface WalletChoiceModalProps {
  onPrivyCreated: (walletAddress: string) => void;
  onExternalChosen: () => void;
}

export function WalletChoiceModal({ onPrivyCreated, onExternalChosen }: WalletChoiceModalProps) {
  const [loading, setLoading] = useState<"privy" | "external" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choosePrivy() {
    setLoading("privy");
    setError(null);
    try {
      const res = await fetch("/api/user/wallet/create", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to create wallet");
      }
      const data = await res.json();
      onPrivyCreated(data.privyWalletAddress ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  async function chooseExternal() {
    setLoading("external");
    setError(null);
    try {
      const res = await fetch("/api/user/wallet/set-mode", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "external" }),
      });
      if (!res.ok) throw new Error("Failed to set wallet mode");
      onExternalChosen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">How do you want to pay?</h2>
          <p className="text-xs text-muted-foreground">
            Pick once — you can switch later from the wallet panel.
          </p>
        </div>

        <Separator />

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          {/* Instant wallet (Privy custodial) — primary, visually dominant */}
          <button
            onClick={choosePrivy}
            disabled={loading !== null}
            className={cn(
              "flex flex-col gap-2 rounded-xl border-2 border-primary/40 bg-primary/5 p-5 text-left shadow-sm transition-colors",
              "hover:border-primary/60 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-foreground">{INSTANT_WALLET_LABEL}</span>
              <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              We create a wallet for you instantly. Deposit once, then chat without signing every
              message.
            </p>
            {loading === "privy" && (
              <p className="text-xs text-primary">Creating wallet…</p>
            )}
          </button>

          {/* External wallet — secondary, visually muted */}
          <button
            onClick={chooseExternal}
            disabled={loading !== null}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/15 p-3.5 text-left opacity-80 transition-colors",
              "hover:border-border hover:bg-muted/30 hover:opacity-100 disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{CONNECTED_WALLET_LABEL}</span>
              <Badge variant="outline" className="text-[10px]">Manual</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Pay with your connected external wallet — approve a quick signature for each subnet call.
            </p>
            {loading === "external" && (
              <p className="text-xs text-muted-foreground">Saving preference…</p>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
