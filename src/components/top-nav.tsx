"use client";

import { PanelLeft, Globe, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ConnectButton } from "@/components/wallet/connect-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  EngineSubnetPicker,
  type EngineSubnetPickerProps,
} from "@/components/engine-subnet-picker";

export type TopNavSubnetPickerProps = EngineSubnetPickerProps;

interface TopNavProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  subnetPicker: TopNavSubnetPickerProps;
  backToDashboardHref?: string;
}

export function TopNav({
  sidebarOpen,
  onToggleSidebar,
  subnetPicker,
  backToDashboardHref,
}: TopNavProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/40 bg-background/60 px-4 backdrop-blur-md z-40">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="shrink-0 rounded-xl p-2.5 text-muted-foreground transition-all duration-300 hover:bg-primary/10 hover:text-primary"
            aria-label="Open sidebar"
          >
            <PanelLeft size={19} />
          </button>
        )}
        {backToDashboardHref ? (
          <Link
            href={backToDashboardHref}
            className="shrink-0 rounded-xl border border-border/50 bg-muted/20 p-2.5 text-muted-foreground transition-all duration-300 hover:bg-primary/10 hover:text-primary"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <h1 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-foreground/90">
            <span className="text-gradient-premium hidden sm:inline">Telegraph</span>
            <span className="text-primary sm:hidden">Telegraph</span>
            <span className="font-black text-muted-foreground/40">/</span>
            <span className="truncate">Intelligence Terminal</span>
          </h1>
          <div className="flex items-center gap-1.5 opacity-60">
            <Globe size={10} className="text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Neural Gateway v1.4.2
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <ThemeToggle />
        <EngineSubnetPicker {...subnetPicker} menuAlign="end" />
        <ConnectButton />
      </div>
    </header>
  );
}
