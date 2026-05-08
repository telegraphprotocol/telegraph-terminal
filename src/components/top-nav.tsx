"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Wallet, PanelLeft, Globe, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const DEMO_NETWORKS = [
  "Preview routing",
  "Ritual",
  "Morpheus",
  "Autonolas",
  "Akash",
  "Fetch.ai",
];

export type TopNavSubnetPickerProps = {
  subnets: Array<{ id: string; label: string }>;
  selectedSubnetId: string | null;
  onSubnetChange: (subnetId: string | null) => void;
  loading?: boolean;
  error?: string | null;
};

interface TopNavProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Live terminal: real engine subnets + optional routing hint */
  subnetPicker?: TopNavSubnetPickerProps;
  /** Compact header control (e.g. return to Kraken dashboard from `/intelligence-terminal`) */
  backToDashboardHref?: string;
}

export function TopNav({
  sidebarOpen,
  onToggleSidebar,
  subnetPicker,
  backToDashboardHref,
}: TopNavProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(DEMO_NETWORKS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const subnetPickerPrimaryLabel = subnetPicker
    ? subnetPicker.loading
      ? "Loading subnets…"
      : subnetPicker.selectedSubnetId
        ? subnetPicker.subnets.find((s) => s.id === subnetPicker.selectedSubnetId)
            ?.label ?? `SN${subnetPicker.selectedSubnetId}`
        : "Auto routing"
    : null;

  return (
    <header className="flex items-center px-4 h-16 border-b border-border/40 bg-background/60 backdrop-blur-md shrink-0 gap-4 z-40">
      {/* Left Section */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="p-2.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300 shrink-0"
            aria-label="Open sidebar"
          >
            <PanelLeft size={19} />
          </button>
        )}
        {backToDashboardHref ? (
          <Link
            href={backToDashboardHref}
            className="p-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300 shrink-0"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </Link>
        ) : null}
        <div className="flex flex-col min-w-0">
           <h1 className="text-[15px] font-bold text-foreground/90 tracking-tight flex items-center gap-2">
            <span className="text-gradient-premium hidden sm:inline">Telegraph</span>
            <span className="sm:hidden text-primary">Telegraph</span>
            <span className="text-muted-foreground/40 font-black">/</span>
            <span className="truncate">Intelligence Terminal</span>
          </h1>
          <div className="flex items-center gap-1.5 opacity-60">
             <Globe size={10} className="text-primary" />
             <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Neural Gateway v1.4.2</span>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />

        {/* Network / subnet selection */}
        <div className="relative flex flex-col items-end gap-0.5" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className={cn(
              "flex h-9 max-w-[min(280px,calc(100vw-12rem))] items-center gap-2 rounded-lg border border-border px-3 text-left transition-colors",
              "hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            aria-label={
              subnetPickerPrimaryLabel
                ? `Subnet routing: ${subnetPickerPrimaryLabel}`
                : `Demo network: ${selectedNetwork}`
            }
          >
            <span className="truncate text-[14px] font-medium leading-tight text-foreground">
              {subnetPickerPrimaryLabel ?? selectedNetwork}
            </span>
            <ChevronDown size={16} className="shrink-0 text-muted-foreground" aria-hidden />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] max-w-[min(90vw,280px)] rounded-2xl border border-border/50 bg-popover/80 backdrop-blur-xl shadow-2xl shadow-primary/20 p-1.5 overflow-hidden"
              >
                {subnetPicker ? (
                  <>
                    {subnetPicker.error ? (
                      <p className="px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                        {subnetPicker.error}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        subnetPicker.onSubnetChange(null);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 text-[13px] font-medium transition-all duration-200 text-left rounded-lg flex items-center justify-between group",
                        subnetPicker.selectedSubnetId === null
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      Auto routing
                      {subnetPicker.selectedSubnetId === null ? (
                        <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                      ) : null}
                    </button>
                    <div className="my-1 h-px bg-border/40" />
                    {subnetPicker.loading ? (
                      <div className="px-3 py-2 text-[12px] text-muted-foreground">Loading subnets…</div>
                    ) : (
                      subnetPicker.subnets.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            subnetPicker.onSubnetChange(s.id);
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2.5 text-[13px] font-medium transition-all duration-200 text-left rounded-lg flex items-center justify-between gap-2 group",
                            subnetPicker.selectedSubnetId === s.id
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          <span className="truncate">{s.label}</span>
                          {subnetPicker.selectedSubnetId === s.id ? (
                            <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                          ) : null}
                        </button>
                      ))
                    )}
                  </>
                ) : (
                  DEMO_NETWORKS.map((network) => (
                    <button
                      key={network}
                      type="button"
                      onClick={() => {
                        setSelectedNetwork(network);
                        setDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 text-[13px] font-medium transition-all duration-200 text-left rounded-lg flex items-center justify-between group",
                        selectedNetwork === network
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {network}
                      {selectedNetwork === network ? (
                        <div className="w-1 h-1 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Connect Wallet */}
        <button className="flex items-center gap-2 h-9 px-4 rounded-xl bg-gradient-premium hover:shadow-[0_0_20px_rgba(140,89,255,0.4)] text-white text-[13px] font-bold transition-all duration-300 border-none">
          <Wallet size={15} />
          <span className="hidden sm:inline">Connect Wallet</span>
        </button>
      </div>
    </header>
  );
}
