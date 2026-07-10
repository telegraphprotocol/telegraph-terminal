"use client";

import { ArrowLeft } from "lucide-react";
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
  extraActions?: React.ReactNode;
}

function HamburgerButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      aria-expanded={open}
      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[5px] transition-all duration-200"
    >
      <span
        className={[
          "block h-px w-[18px] bg-foreground/70 transition-all duration-200 origin-center",
          open ? "translate-y-[6px] rotate-45" : "",
        ].join(" ")}
      />
      <span
        className={[
          "block h-px w-[18px] bg-foreground/70 transition-all duration-200",
          open ? "opacity-0 scale-x-0" : "",
        ].join(" ")}
      />
      <span
        className={[
          "block h-px w-[18px] bg-foreground/70 transition-all duration-200 origin-center",
          open ? "-translate-y-[6px] -rotate-45" : "",
        ].join(" ")}
      />
    </button>
  );
}

export function TopNav({
  sidebarOpen,
  onToggleSidebar,
  subnetPicker,
  backToDashboardHref,
  extraActions,
}: TopNavProps) {
  const showGlobalWallet =
    process.env.NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402 === "true";

  return (
    <header className="z-40 shrink-0 border-b border-border/80 bg-background/55 shadow-sm backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/40">
      {/* Mobile: two-row layout */}
      <div className="flex flex-col md:hidden">
        {/* Row 1 */}
        <div className="flex h-14 items-center gap-3 px-4">
          <HamburgerButton open={sidebarOpen} onClick={onToggleSidebar} />

          {backToDashboardHref && (
            <Link
              href={backToDashboardHref}
              className="flex h-9 min-w-[44px] items-center gap-1.5 border border-foreground/50 bg-foreground/10 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-foreground/80 hover:bg-foreground/20"
              title="Back to dashboard"
            >
              <ArrowLeft size={12} strokeWidth={2.5} />
              <span>Go Back</span>
            </Link>
          )}

          <Link
            href="https://telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 flex-col"
          >
            <span className="truncate text-[13px] font-bold uppercase tracking-[0.12em] text-foreground leading-none">
              Telegraph
            </span>
            <span className="truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80 leading-none mt-1">
              Intelligence Terminal
            </span>
          </Link>

          {extraActions}
          <ThemeToggle />
        </div>

        {/* Row 2: subnet + wallet */}
        <div className="flex h-10 items-center gap-2 border-t border-border/50 px-4">
          <div className="min-w-0 flex-1">
            <EngineSubnetPicker {...subnetPicker} menuAlign="end" />
          </div>
          {showGlobalWallet && (
            <div className="shrink-0">
              <GlobalWallet />
            </div>
          )}
        </div>
      </div>

      {/* Desktop: single row */}
      <div className="hidden h-14 items-center gap-4 px-5 md:flex">
        {/* Left: hamburger + back + wordmark */}
        <div className="flex shrink-0 items-center gap-3">
          <HamburgerButton open={sidebarOpen} onClick={onToggleSidebar} />

          {backToDashboardHref && (
            <Link
              href={backToDashboardHref}
              className="flex h-7 items-center gap-1.5 border border-foreground/50 bg-foreground/10 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-foreground/80 hover:bg-foreground/20"
              title="Back to dashboard"
            >
              <ArrowLeft size={12} strokeWidth={2.5} />
              <span>Go Back</span>
            </Link>
          )}

          {/* Wordmark */}
          <Link
            href="https://telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-baseline gap-2"
          >
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-foreground">
              Telegraph
            </span>
            <span className="hidden text-[10px] uppercase tracking-[0.12em] text-muted-foreground/75 lg:block">
              Intelligence Terminal
            </span>
          </Link>
        </div>

        {/* Divider */}
        <div className="mx-1 h-4 w-px bg-border/60" />

        {/* Right: tools */}
        <div className="flex flex-1 items-center justify-end gap-2">
          <div className="min-w-0 max-w-[min(280px,calc(100vw-20rem))] shrink">
            <EngineSubnetPicker {...subnetPicker} menuAlign="end" />
          </div>
          {extraActions}
          <ThemeToggle />
          {showGlobalWallet && <GlobalWallet className="shrink-0" />}
        </div>
      </div>
    </header>
  );
}
