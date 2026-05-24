"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { authHeaders } from "@/lib/auth";

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
          <h2 className="text-base font-semibold text-foreground">Choose payment mode</h2>
          <p className="text-xs text-muted-foreground">
            How would you like to pay for AI queries on Telegraph Terminal?
          </p>
        </div>

        <Separator />

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          {/* Privy custodial option */}
          <button
            onClick={choosePrivy}
            disabled={loading !== null}
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 text-left transition-colors",
              "hover:border-primary/50 hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Privy wallet</span>
              <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              We create a secure server wallet for you. Deposit USDC once and every query is paid
              automatically — no wallet popups.
            </p>
            {loading === "privy" && (
              <p className="text-xs text-primary">Creating wallet…</p>
            )}
          </button>

          {/* External wallet option */}
          <button
            onClick={chooseExternal}
            disabled={loading !== null}
            className={cn(
              "flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 text-left transition-colors",
              "hover:border-border/80 hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">External wallet</span>
              <Badge variant="outline" className="text-[10px]">Manual</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Use your connected wallet to approve each payment individually. A signature is
              required for every message you send.
            </p>
            {loading === "external" && (
              <p className="text-xs text-muted-foreground">Saving preference…</p>
            )}
          </button>
        </div>

        <p className="text-center text-[10px] text-muted-foreground">
          You can change this later from the wallet panel.
        </p>
      </div>
    </div>,
    document.body,
  );
}
