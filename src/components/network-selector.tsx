"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePaymentNetwork, PAYMENT_NETWORKS } from "@/lib/network-context";
import { cn } from "@/lib/utils";
import { useAccount, useDisconnect } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";

const PANEL_MARGIN = 8;

function computePanelGeometry(rect: DOMRect, width: number) {
  const clampedWidth = Math.min(width, window.innerWidth - PANEL_MARGIN * 2);
  const left = Math.max(
    PANEL_MARGIN,
    Math.min(rect.right - clampedWidth, window.innerWidth - clampedWidth - PANEL_MARGIN),
  );
  return { top: rect.bottom + PANEL_MARGIN, left, width: clampedWidth };
}

export function NetworkSelector() {
  const { network, setNetwork } = usePaymentNetwork();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [geometry, setGeometry] = useState<{ top: number; left: number; width: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerGeometry, setBannerGeometry] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isConnected: evmConnected } = useAccount();
  const { disconnect: evmDisconnect } = useDisconnect();
  const { publicKey: solanaPubkey, disconnect: solanaDisconnect } = useWallet();

  const current = PAYMENT_NETWORKS.find((n) => n.value === network)!;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function showBanner(msg: string) {
    setBanner(msg);
    if (btnRef.current) setBannerGeometry(computePanelGeometry(btnRef.current.getBoundingClientRect(), 320));
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }

  function handleSelect(value: string) {
    if (value === network) { setOpen(false); return; }

    if (value === "solana" && evmConnected) {
      evmDisconnect();
      showBanner("EVM wallet disconnected — connect a Solana wallet to pay.");
    } else if (value === "base-sepolia" && solanaPubkey) {
      solanaDisconnect().catch(() => undefined);
      showBanner("Solana wallet disconnected — connect a Base Sepolia wallet to pay.");
    }

    setNetwork(value as typeof network);
    setOpen(false);
  }

  function toggle() {
    if (!open && btnRef.current) {
      setGeometry(computePanelGeometry(btnRef.current.getBoundingClientRect(), 220));
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={ref} className="relative flex min-w-0 flex-col gap-0.5">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Payment network: ${current.label}`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 whitespace-nowrap border px-2.5 sm:px-3 text-left transition-all",
          "focus:outline-none",
          "border-emerald-600/50 bg-emerald-500/10 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400",
          "hover:border-emerald-600/70 hover:bg-emerald-500/15 hover:text-emerald-800 dark:hover:border-emerald-500/60 dark:hover:text-emerald-300",
        )}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-60 dark:bg-emerald-400" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
        </span>
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={12} className="shrink-0 text-emerald-700/70 dark:text-emerald-400/70" aria-hidden />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && geometry && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role="listbox"
              aria-label="Select payment network"
              style={{ position: "fixed", top: geometry.top, left: geometry.left, width: geometry.width }}
              className="z-50 border border-emerald-500/30 bg-popover/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              {PAYMENT_NETWORKS.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  role="option"
                  aria-selected={n.value === network}
                  onClick={() => handleSelect(n.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-all duration-200",
                    n.value === network
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "text-muted-foreground hover:bg-emerald-500/8 hover:text-emerald-700 dark:hover:text-emerald-300",
                  )}
                >
                  <span className="truncate">{n.label}</span>
                  {n.value === network && (
                    <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {mounted && createPortal(
        <AnimatePresence>
          {banner && bannerGeometry && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "fixed",
                top: bannerGeometry.top,
                left: bannerGeometry.left,
                width: bannerGeometry.width,
              }}
              className="z-50 flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 backdrop-blur-sm"
            >
              <p className="flex-1 text-[11px] text-amber-400 leading-relaxed">{banner}</p>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="shrink-0 text-amber-400/60 hover:text-amber-400 transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
