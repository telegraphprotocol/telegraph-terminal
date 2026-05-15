"use client";

import { PanelLeft, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GlobalWallet } from "@/components/global-wallet";
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

function NavLeadingControls({
  sidebarOpen,
  onToggleSidebar,
  backToDashboardHref,
}: Pick<TopNavProps, "sidebarOpen" | "onToggleSidebar" | "backToDashboardHref">) {
  return (
    <>
      {!sidebarOpen && (
        <button
          type="button"
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
    </>
  );
}

export function TopNav({
  sidebarOpen,
  onToggleSidebar,
  subnetPicker,
  backToDashboardHref,
}: TopNavProps) {
  const showGlobalWallet =
    process.env.NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402 === "true";
  const titleAndSubtitle = (
    <div className="flex min-w-0 flex-1 flex-col">
      <h1 className="min-w-0 truncate whitespace-nowrap text-[14px] font-bold tracking-tight text-foreground/90 md:text-[15px]">
        <span className="text-gradient-premium">Telegraph Intelligence Terminal</span>
      </h1>
    </div>
  );

  const tools = (
    <>
      <ThemeToggle />
      <EngineSubnetPicker {...subnetPicker} menuAlign="end" />
      {showGlobalWallet ? <GlobalWallet className="shrink-0" /> : null}
    </>
  );

  return (
    <header className="z-40 flex shrink-0 flex-col gap-2 border-b border-border/40 bg-background/60 px-4 py-2 backdrop-blur-md md:h-16 md:flex-row md:items-center md:gap-4 md:py-0">
      {/* Mobile: row 1 (nav + title), row 2 (tools) */}
      <div className="flex w-full min-w-0 flex-col gap-2 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <NavLeadingControls
            sidebarOpen={sidebarOpen}
            onToggleSidebar={onToggleSidebar}
            backToDashboardHref={backToDashboardHref}
          />
          {titleAndSubtitle}
        </div>
        <div className="flex w-full min-w-0 items-center gap-2">
          <ThemeToggle />
          <div className="min-w-0 flex-1">
            <EngineSubnetPicker {...subnetPicker} menuAlign="end" />
          </div>
          <div className="shrink-0">
            {showGlobalWallet ? <GlobalWallet className="shrink-0" /> : null}
          </div>
        </div>
      </div>

      {/* Desktop: original single row */}
      <div className="hidden min-h-0 min-w-0 flex-1 items-center gap-4 md:flex">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <NavLeadingControls
            sidebarOpen={sidebarOpen}
            onToggleSidebar={onToggleSidebar}
            backToDashboardHref={backToDashboardHref}
          />
          {titleAndSubtitle}
        </div>
        <div className="flex shrink-0 items-center gap-3">{tools}</div>
      </div>
    </header>
  );
}
