"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { authHeaders } from "@/lib/auth";

interface WalletChoiceModalProps {
  onPrivyCreated: (evmAddress: string, solanaAddress: string) => void;
  /** @deprecated kept for backward compat — no longer shown */
  onExternalChosen?: () => void;
  /** @deprecated kept for backward compat — no longer used */
  solanaOnly?: boolean;
}

export function WalletChoiceModal({ onPrivyCreated }: WalletChoiceModalProps) {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function create() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/user/wallet/create", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Unable to set up wallets. Please try again.");
      }
      const data = await res.json() as {
        privyWalletAddress?: string | null;
        privySolanaWalletAddress?: string | null;
      };
      onPrivyCreated(data.privyWalletAddress ?? "", data.privySolanaWalletAddress ?? "");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  useEffect(() => {
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl flex flex-col gap-4 items-center text-center">
        {status === "loading" ? (
          <>
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-foreground">Setting up your wallets…</p>
            <p className="text-xs text-muted-foreground">Creating EVM and Solana Privy wallets for you.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-destructive">Wallet setup failed</p>
            {errorMsg && (
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
            )}
            <button
              onClick={() => void create()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
