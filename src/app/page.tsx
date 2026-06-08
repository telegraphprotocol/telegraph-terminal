"use client";

import { KrakenCategoryFilter } from "@/components/kraken/kraken-category-filter";
import { KrakenFeed } from "@/components/kraken/kraken-feed";
import { KrakenSignalDetailsDialog } from "@/components/kraken/kraken-signal-details-dialog";
import { KrakenSkillCards } from "@/components/kraken/kraken-skill-cards";
import { KrakenAnalytics } from "@/components/kraken/kraken-analytics";
import { KrakenAlerts } from "@/components/kraken/kraken-alerts";
import { Search, Bell, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { GlobalWallet } from "@/components/global-wallet";
import { EngineSubnetPicker } from "@/components/engine-subnet-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiClient } from "@/lib/api-client";
import { DaemonResultItem } from "@/lib/engine-daemon-types";
import { DEFAULT_SELECTED_CATEGORIES, type DashboardCategoryId } from "@/lib/kraken-dashboard-filters";
import {
  KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS,
  KRAKEN_FEED_POLL_INTERVAL_MS,
} from "@/lib/kraken-dashboard-config";
import { useKrakenCollectorCache } from "@/lib/use-kraken-collector-cache";
import { normalizeEngineSubnets, type SubnetPickItem } from "@/lib/subnet-catalog";
import { downloadSignalsCsv } from "@/lib/export-signals-csv";

function KrakenLogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="151"
      height="26"
      viewBox="0 0 151 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M33.4999 1.5H37.0999V11L46.6999 1.5H51.4999L42.8999 9.8L51.8999 23.8H47.0999L40.0999 12.5L36.9999 15.5V23.9H33.3999L33.4999 1.5Z"
        fill="currentColor"
      />
      <path
        d="M53.8999 1.5H57.4999V5.4C57.7999 4.7 58.4999 3.7 59.5999 2.7C60.6999 1.6 61.9999 1.1 63.4999 1.1C63.5999 1.1 63.6999 1.1 63.8999 1.1C64.0999 1.1 64.3999 1.1 64.7999 1.2V5.2C64.5999 5.2 64.3999 5.1 64.1999 5.1C63.9999 5.1 63.7999 5.1 63.5999 5.1C61.6999 5.1 60.2999 5.7 59.2999 6.9C58.2999 8.1 57.7999 9.5 57.7999 11.1V23.9H53.9999L53.8999 1.5Z"
        fill="currentColor"
      />
      <path
        d="M78.7002 10.3C79.6002 10.2 80.1002 9.8 80.4002 9.2C80.6002 8.9 80.6002 8.4 80.6002 7.8C80.6002 6.5 80.1002 5.6 79.2002 5C78.3002 4.4 77.0002 4.1 75.3002 4.1C73.3002 4.1 72.0002 4.6 71.1002 5.7C70.6002 6.3 70.3002 7.2 70.2002 8.3H66.7002C66.8002 5.5 67.7002 3.6 69.4002 2.6C71.2002 1.5 73.1002 1 75.4002 1C78.0002 1 80.1002 1.5 81.8002 2.5C83.4002 3.5 84.2002 5.1 84.2002 7.2V20C84.2002 20.4 84.3002 20.7 84.4002 20.9C84.6002 21.1 84.9002 21.3 85.4002 21.3C85.6002 21.3 85.8002 21.3 86.0002 21.3C86.2002 21.3 86.4002 21.2 86.7002 21.2V24C86.1002 24.2 85.7002 24.3 85.4002 24.3C85.1002 24.3 84.7002 24.4 84.2002 24.4C82.9002 24.4 82.0002 23.9 81.4002 23C81.1002 22.5 80.9002 21.8 80.8002 20.9C80.0002 21.9 78.9002 22.8 77.5002 23.5C76.1002 24.2 74.5002 24.6 72.8002 24.6C70.7002 24.6 69.0002 24 67.7002 22.7C66.4002 21.4 65.7002 19.9 65.7002 18C65.7002 15.9 66.3002 14.3 67.6002 13.2C68.9002 12.1 70.6002 11.4 72.7002 11.1L78.7002 10.3ZM70.8002 20.4C71.6002 21 72.5002 21.3 73.6002 21.3C74.9002 21.3 76.2002 21 77.4002 20.4C79.5002 19.4 80.5002 17.7 80.5002 15.4V12.4C80.0002 12.7 79.5002 12.9 78.7002 13.1C77.9002 13.3 77.3002 13.4 76.6002 13.5L74.4002 14C73.0002 14.2 72.0002 14.5 71.3002 14.9C70.1002 15.6 69.6002 16.6 69.6002 18C69.6002 19 70.0002 19.8 70.8002 20.4Z"
        fill="currentColor"
      />
      <path
        d="M89.2001 1.5H92.8001V11L102.4 1.5H107.2L98.6001 9.8L107.6 23.8H102.8L95.8001 12.5L92.7001 15.5V23.9H89.1001L89.2001 1.5Z"
        fill="currentColor"
      />
      <path
        d="M122.9 2.2C124.4 2.9 125.5 3.9 126.3 5.1C127 6.2 127.5 7.5 127.8 9C128 10 128.1 11.7 128.1 13.9H111.9C112 16.2 112.5 18 113.5 19.4C114.5 20.8 116 21.5 118.1 21.5C120 21.5 121.6 20.9 122.7 19.6C123.3 18.8 123.8 18 124.1 17H127.8C127.7 17.8 127.4 18.7 126.8 19.7C126.3 20.7 125.6 21.5 125 22.2C123.9 23.3 122.5 24.1 120.8 24.4C119.9 24.6 118.9 24.7 117.8 24.7C115 24.7 112.7 23.7 110.8 21.7C108.9 19.7 107.9 16.9 107.9 13.3C107.9 9.7 108.9 6.8 110.8 4.6C112.7 2.4 115.3 1.2 118.4 1.2C119.9 0.999999 121.4 1.4 122.9 2.2ZM124.3 10.9C124.1 9.3 123.8 8 123.2 7C122.2 5.2 120.5 4.3 118.1 4.3C116.4 4.3 115 4.9 113.8 6.2C112.6 7.4 112 9 112 10.9H124.3Z"
        fill="currentColor"
      />
      <path
        d="M131.4 1.5H135V4.7C136.1 3.4 137.2 2.5 138.4 1.9C139.6 1.3 140.9 1 142.3 1C145.5 1 147.6 2.1 148.7 4.3C149.3 5.5 149.6 7.2 149.6 9.5V23.8H145.8V9.8C145.8 8.4 145.6 7.3 145.2 6.5C144.5 5.1 143.3 4.4 141.6 4.4C140.7 4.4 140 4.5 139.4 4.7C138.4 5 137.5 5.6 136.7 6.5C136.1 7.2 135.7 8 135.5 8.8C135.3 9.6 135.2 10.7 135.2 12.2V23.9H131.5L131.4 1.5Z"
        fill="currentColor"
      />
      <path
        d="M15.2 1.5C7.4 1.5 1 7.8 1 15.7V21.8C1 22.9 1.9 23.8 3 23.8C4.1 23.8 5 22.9 5 21.8V15.7C5 14.6 5.9 13.7 7 13.7C8.1 13.7 9 14.6 9 15.7V21.8C9 22.9 9.9 23.8 11 23.8C12.1 23.8 13 22.9 13 21.8V15.7C13 14.6 13.9 13.7 15 13.7C16.1 13.7 17 14.6 17 15.7V21.8C17 22.9 17.9 23.8 19 23.8C20.1 23.8 21 22.9 21 21.8V15.7C21 14.6 21.9 13.7 23 13.7C24.1 13.7 25 14.6 25 15.7V21.8C25 22.9 25.9 23.8 27 23.8C28.1 23.8 29 22.9 29 21.8V15.7C29.5 7.8 23.1 1.5 15.2 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

const HEADER_NAV_LINKS = [
  { label: "Dashboard", active: true, href: "/" },
  { label: "Intelligence Feed", active: false, href: "#" },
  { label: "Protocol Health", active: false, href: "#" },
  { label: "Settlements", active: false, href: "#" },
] as const;

const headerSearchFieldClass =
  "h-9 w-full border border-border/60 bg-transparent pl-9 pr-3 text-[12px] font-mono uppercase tracking-[0.06em] text-foreground placeholder:text-muted-foreground/40 transition-colors focus:border-foreground/25 focus:outline-none";

const krakenMainSurfaceClassName =
  "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-6 custom-scrollbar bg-dot-grid";

function KrakenHeaderNav({ className }: { className?: string }) {
  return (
    <nav className={cn("no-scrollbar flex items-center gap-8 overflow-x-auto", className)} aria-label="Primary navigation">
      {HEADER_NAV_LINKS.map((item) =>
        item.active ? (
          <Link
            key={item.label}
            href={item.href}
            className="relative shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] transition-colors min-h-11 flex items-center lg:min-h-0 text-foreground after:absolute after:inset-x-0 after:-bottom-[1px] after:h-px after:bg-foreground/60"
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            title="Coming soon"
            className="relative shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] min-h-11 flex items-center lg:min-h-0 text-muted-foreground/30 cursor-not-allowed select-none"
          >
            {item.label}
          </span>
        )
      )}
    </nav>
  );
}

export default function KrakenDashboard() {
  const showGlobalWallet =
    process.env.NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402 === "true";
  const [selectedCategories, setSelectedCategories] = useState<DashboardCategoryId[]>([
    ...DEFAULT_SELECTED_CATEGORIES,
  ]);
  const [sort, setSort] = useState<"recent" | "interest" | "affected" | "audience">("affected");
  const [sinceHours, setSinceHours] = useState(24);
  const [useManualTimeRange, setUseManualTimeRange] = useState(true);

  const feed = useKrakenCollectorCache({
    sort,
    sinceHours,
    useManualTimeRange,
    selectedCategories,
  });

  const [engineSubnets, setEngineSubnets] = useState<SubnetPickItem[]>([]);
  const [engineSubnetsLoading, setEngineSubnetsLoading] = useState(true);
  const [engineSubnetsError, setEngineSubnetsError] = useState<string | null>(null);
  const [dashboardSubnetId, setDashboardSubnetId] = useState<string | null>(null);
  const [detailsItem, setDetailsItem] = useState<DaemonResultItem | null>(null);

  useEffect(() => {
    document.title = "Kraken Intelligence Dashboard";
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void feed.pollTick();
    }, KRAKEN_FEED_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [feed.pollTick]);

  useEffect(() => {
    if (!feed.autoAdvanceEnabled) return;
    const id = setInterval(() => {
      void feed.goToNextPage();
    }, KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [feed.autoAdvanceEnabled, feed.goToNextPage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.listSubnets();
        if (!cancelled) {
          setEngineSubnets(normalizeEngineSubnets(data));
          setEngineSubnetsError(null);
        }
      } catch {
        if (!cancelled) {
          setEngineSubnets([]);
          setEngineSubnetsError("Could not reach engine `/v1/subnets`. Is it running?");
        }
      } finally {
        if (!cancelled) setEngineSubnetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCategoriesChange = useCallback((next: DashboardCategoryId[]) => {
    setSelectedCategories(next);
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Kraken header */}
        <header className="z-20 shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-[14px]">
          {/* ── Mobile ── */}
          <div className="lg:hidden">
            {/* Row 1: logo + actions */}
            <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
              <KrakenLogoMark className="h-[18px] w-auto shrink-0 text-foreground" />

              {/* Spacer */}
              <div className="flex-1" />

              {/* Action cluster */}
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="shrink-0">
                  <EngineSubnetPicker
                    subnets={engineSubnets}
                    selectedSubnetId={dashboardSubnetId}
                    onSubnetChange={setDashboardSubnetId}
                    loading={engineSubnetsLoading}
                    error={engineSubnetsError}
                    menuAlign="end"
                  />
                </div>
                <Link
                  href="/intelligence-terminal"
                  className="relative inline-flex items-center gap-1.5 border border-amber-600/70 bg-amber-500/10 px-2.5 min-h-[44px] text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600 transition-all hover:border-amber-600 hover:bg-amber-500/15 hover:text-amber-700 dark:border-amber-500/80 dark:text-amber-400 dark:hover:border-amber-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
                  title="Open Intelligence Terminal"
                >
                  <MessageSquare size={14} aria-hidden />
                  <span>Terminal</span>
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                </Link>
                <button
                  type="button"
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-border/60 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground min-h-[44px] min-w-[44px]"
                >
                  <Bell size={16} />
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                </button>
                <ThemeToggle />
                {showGlobalWallet && <GlobalWallet className="shrink-0" />}
              </div>
            </div>

            {/* Row 2: search */}
            <div className="relative border-t border-border/30 px-4 sm:px-5">
              <Search className="pointer-events-none absolute left-7 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/50" size={14} aria-hidden />
              <input
                type="text"
                placeholder="Search intelligence feed, wallets, or protocols..."
                className={cn(headerSearchFieldClass, "border-0 border-b-0 py-3")}
              />
            </div>

            {/* Row 3: nav links */}
            <KrakenHeaderNav className="no-scrollbar overflow-x-auto border-t border-border/30 px-4 py-3 sm:px-5" />
          </div>

          {/* ── Desktop (lg+): two rows ── */}
          <div className="hidden lg:block">
            {/* Row 1: logo | search | actions */}
            <div className="flex h-14 items-center gap-4 px-5 xl:px-6">
              {/* Logo */}
              <div className="shrink-0">
                <KrakenLogoMark className="h-[20px] w-auto text-foreground" />
              </div>

              {/* Divider */}
              <div className="h-4 w-px shrink-0 bg-border/60" />

              {/* Search */}
              <div className="flex min-w-0 flex-1 items-center">
                <div className="relative w-full max-w-[440px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/50" size={14} aria-hidden />
                  <input
                    type="text"
                    placeholder="Search feed, wallets, or protocols..."
                    className={headerSearchFieldClass}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-2">
                <div className="min-w-0 max-w-[200px] shrink lg:max-w-[240px] xl:max-w-[280px]">
                  <EngineSubnetPicker
                    subnets={engineSubnets}
                    selectedSubnetId={dashboardSubnetId}
                    onSubnetChange={setDashboardSubnetId}
                    loading={engineSubnetsLoading}
                    error={engineSubnetsError}
                    menuAlign="end"
                  />
                </div>

                <div className="h-4 w-px shrink-0 bg-border/40" />

                {/* Terminal link */}
                <Link
                  href="/intelligence-terminal"
                  className="relative inline-flex items-center gap-1.5 whitespace-nowrap border border-amber-600/70 bg-amber-500/10 px-3 h-8 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600 transition-all hover:border-amber-600 hover:bg-amber-500/15 hover:text-amber-700 dark:border-amber-500/80 dark:text-amber-400 dark:hover:border-amber-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
                  title="Open Intelligence Terminal"
                >
                  <MessageSquare size={13} aria-hidden />
                  <span>Terminal</span>
                  <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                </Link>

                <button
                  type="button"
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center border border-border/60 text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground"
                  aria-label="Notifications"
                >
                  <Bell size={15} />
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                </button>

                <ThemeToggle />
                {showGlobalWallet && <GlobalWallet className="shrink-0" />}
              </div>
            </div>

            {/* Row 2: nav links */}
            <div className="border-t border-border/30">
              <KrakenHeaderNav className="px-5 xl:px-6 py-0 h-10" />
            </div>
          </div>
        </header>
        <main className={krakenMainSurfaceClassName}>
          <div className="max-w-[1440px] mx-auto flex flex-col gap-8 xl:flex-row">
            
            {/* Main Content (Left + Center) */}
            <div className="flex-1 flex flex-col gap-8 min-w-0">
              {/* Top Section: Feed */}
              <section className="flex flex-col gap-4">
                {feed.error && (
                  <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    Daemon read API error: {feed.error}
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-px bg-foreground/50" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Signal Feed</h2>
                </div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KrakenCategoryFilter
                      selected={selectedCategories}
                      onChange={handleCategoriesChange}
                    />
                    <select
                      value={sort}
                      onChange={(e) => {
                        setSort(e.target.value as "recent" | "interest" | "affected" | "audience");
                        feed.resetPageIndex();
                      }}
                      className="h-9 px-3 bg-muted/40 border border-border/50 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      <option value="recent">RECENT</option>
                      <option value="interest">INTEREST</option>
                      <option value="affected">AFFECTED</option>
                      <option value="audience">AUDIENCE</option>
                    </select>
                    <select
                      value={sinceHours}
                      onChange={(e) => {
                        setSinceHours(Number(e.target.value));
                        setUseManualTimeRange(true);
                        feed.resetPageIndex();
                      }}
                      className="h-9 px-3 bg-muted/40 border border-border/50 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground focus:outline-none focus:border-foreground/30"
                    >
                      <option value={1}>LAST 1H</option>
                      <option value={6}>LAST 6H</option>
                      <option value={24}>LAST 24H</option>
                      <option value={72}>LAST 72H</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={feed.signals.length === 0}
                    onClick={() => downloadSignalsCsv(feed.signals)}
                    className="h-9 px-3 bg-muted/40 border border-border/50 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    Export CSV
                  </button>
                </div>
                <KrakenFeed
                  items={feed.signals}
                  loading={feed.showTableSpinner}
                  onRowSelect={(item) => setDetailsItem(item)}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>
                    Showing {feed.signals.length} of {feed.filteredTotal} feed
                    {feed.cacheSize > 0 ? ` · ${feed.cacheSize} cached` : ""}
                    {feed.footerStats ? ` · ${feed.footerStats}` : ""}
                    {feed.footerExtra}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={feed.pageIndex === 0}
                      onClick={feed.prevPage}
                      className="h-8 px-3 border border-border/50 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Prev
                    </button>
                    <button
                      disabled={!feed.canGoNext || feed.isFetchingNextPage}
                      onClick={() => void feed.goToNextPage()}
                      className="h-8 px-3 border border-border/50 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {feed.isFetchingNextPage ? "Loading…" : "Next"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4 xl:hidden" aria-label="Live alpha alerts">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-px bg-foreground/50" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Live Alpha Alerts</h2>
                </div>
                <KrakenAlerts alerts={feed.topAlerts} loading={feed.showTableSpinner && feed.topAlerts.length === 0} />
              </section>

              {/* Engine subnets from `/v1/subnets` (no static placeholder protocols) */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-px bg-foreground/50" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Engine Subnets</h2>
                </div>
                <KrakenSkillCards
                  engineSubnets={engineSubnets}
                  subnetsLoading={engineSubnetsLoading}
                  subnetsError={engineSubnetsError}
                />
              </section>

              {/* Bottom Section: Analytics */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-px bg-foreground/50" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Protocol Efficiency</h2>
                </div>
                <KrakenAnalytics items={feed.signals} loading={feed.showTableSpinner} />
              </section>
            </div>

            {/* Right Sidebar (Alerts) */}
            <aside className="w-[min(420px,30vw)] shrink-0 hidden xl:block self-start sticky top-0">
              <KrakenAlerts alerts={feed.topAlerts} loading={feed.showTableSpinner && feed.topAlerts.length === 0} />
            </aside>
          </div>
        </main>
      </div>

      <KrakenSignalDetailsDialog
        item={detailsItem}
        open={detailsItem !== null}
        onOpenChange={(open) => {
          if (!open) setDetailsItem(null);
        }}
      />
    </div>
  );
}

