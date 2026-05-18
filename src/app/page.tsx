"use client";

import { KrakenCategoryFilter } from "@/components/kraken/kraken-category-filter";
import { KrakenFeed } from "@/components/kraken/kraken-feed";
import { KrakenSignalDetailsDialog } from "@/components/kraken/kraken-signal-details-dialog";
import { KrakenSkillCards } from "@/components/kraken/kraken-skill-cards";
import { KrakenAnalytics } from "@/components/kraken/kraken-analytics";
import { KrakenAlerts } from "@/components/kraken/kraken-alerts";
import { Search, Bell, LayoutDashboard, Database, Shield, Zap, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { GlobalWallet } from "@/components/global-wallet";
import { EngineSubnetPicker } from "@/components/engine-subnet-picker";
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
        fill="#5841D8"
      />
      <path
        d="M53.8999 1.5H57.4999V5.4C57.7999 4.7 58.4999 3.7 59.5999 2.7C60.6999 1.6 61.9999 1.1 63.4999 1.1C63.5999 1.1 63.6999 1.1 63.8999 1.1C64.0999 1.1 64.3999 1.1 64.7999 1.2V5.2C64.5999 5.2 64.3999 5.1 64.1999 5.1C63.9999 5.1 63.7999 5.1 63.5999 5.1C61.6999 5.1 60.2999 5.7 59.2999 6.9C58.2999 8.1 57.7999 9.5 57.7999 11.1V23.9H53.9999L53.8999 1.5Z"
        fill="#5841D8"
      />
      <path
        d="M78.7002 10.3C79.6002 10.2 80.1002 9.8 80.4002 9.2C80.6002 8.9 80.6002 8.4 80.6002 7.8C80.6002 6.5 80.1002 5.6 79.2002 5C78.3002 4.4 77.0002 4.1 75.3002 4.1C73.3002 4.1 72.0002 4.6 71.1002 5.7C70.6002 6.3 70.3002 7.2 70.2002 8.3H66.7002C66.8002 5.5 67.7002 3.6 69.4002 2.6C71.2002 1.5 73.1002 1 75.4002 1C78.0002 1 80.1002 1.5 81.8002 2.5C83.4002 3.5 84.2002 5.1 84.2002 7.2V20C84.2002 20.4 84.3002 20.7 84.4002 20.9C84.6002 21.1 84.9002 21.3 85.4002 21.3C85.6002 21.3 85.8002 21.3 86.0002 21.3C86.2002 21.3 86.4002 21.2 86.7002 21.2V24C86.1002 24.2 85.7002 24.3 85.4002 24.3C85.1002 24.3 84.7002 24.4 84.2002 24.4C82.9002 24.4 82.0002 23.9 81.4002 23C81.1002 22.5 80.9002 21.8 80.8002 20.9C80.0002 21.9 78.9002 22.8 77.5002 23.5C76.1002 24.2 74.5002 24.6 72.8002 24.6C70.7002 24.6 69.0002 24 67.7002 22.7C66.4002 21.4 65.7002 19.9 65.7002 18C65.7002 15.9 66.3002 14.3 67.6002 13.2C68.9002 12.1 70.6002 11.4 72.7002 11.1L78.7002 10.3ZM70.8002 20.4C71.6002 21 72.5002 21.3 73.6002 21.3C74.9002 21.3 76.2002 21 77.4002 20.4C79.5002 19.4 80.5002 17.7 80.5002 15.4V12.4C80.0002 12.7 79.5002 12.9 78.7002 13.1C77.9002 13.3 77.3002 13.4 76.6002 13.5L74.4002 14C73.0002 14.2 72.0002 14.5 71.3002 14.9C70.1002 15.6 69.6002 16.6 69.6002 18C69.6002 19 70.0002 19.8 70.8002 20.4Z"
        fill="#5841D8"
      />
      <path
        d="M89.2001 1.5H92.8001V11L102.4 1.5H107.2L98.6001 9.8L107.6 23.8H102.8L95.8001 12.5L92.7001 15.5V23.9H89.1001L89.2001 1.5Z"
        fill="#5841D8"
      />
      <path
        d="M122.9 2.2C124.4 2.9 125.5 3.9 126.3 5.1C127 6.2 127.5 7.5 127.8 9C128 10 128.1 11.7 128.1 13.9H111.9C112 16.2 112.5 18 113.5 19.4C114.5 20.8 116 21.5 118.1 21.5C120 21.5 121.6 20.9 122.7 19.6C123.3 18.8 123.8 18 124.1 17H127.8C127.7 17.8 127.4 18.7 126.8 19.7C126.3 20.7 125.6 21.5 125 22.2C123.9 23.3 122.5 24.1 120.8 24.4C119.9 24.6 118.9 24.7 117.8 24.7C115 24.7 112.7 23.7 110.8 21.7C108.9 19.7 107.9 16.9 107.9 13.3C107.9 9.7 108.9 6.8 110.8 4.6C112.7 2.4 115.3 1.2 118.4 1.2C119.9 0.999999 121.4 1.4 122.9 2.2ZM124.3 10.9C124.1 9.3 123.8 8 123.2 7C122.2 5.2 120.5 4.3 118.1 4.3C116.4 4.3 115 4.9 113.8 6.2C112.6 7.4 112 9 112 10.9H124.3Z"
        fill="#5841D8"
      />
      <path
        d="M131.4 1.5H135V4.7C136.1 3.4 137.2 2.5 138.4 1.9C139.6 1.3 140.9 1 142.3 1C145.5 1 147.6 2.1 148.7 4.3C149.3 5.5 149.6 7.2 149.6 9.5V23.8H145.8V9.8C145.8 8.4 145.6 7.3 145.2 6.5C144.5 5.1 143.3 4.4 141.6 4.4C140.7 4.4 140 4.5 139.4 4.7C138.4 5 137.5 5.6 136.7 6.5C136.1 7.2 135.7 8 135.5 8.8C135.3 9.6 135.2 10.7 135.2 12.2V23.9H131.5L131.4 1.5Z"
        fill="#5841D8"
      />
      <path
        d="M15.2 1.5C7.4 1.5 1 7.8 1 15.7V21.8C1 22.9 1.9 23.8 3 23.8C4.1 23.8 5 22.9 5 21.8V15.7C5 14.6 5.9 13.7 7 13.7C8.1 13.7 9 14.6 9 15.7V21.8C9 22.9 9.9 23.8 11 23.8C12.1 23.8 13 22.9 13 21.8V15.7C13 14.6 13.9 13.7 15 13.7C16.1 13.7 17 14.6 17 15.7V21.8C17 22.9 17.9 23.8 19 23.8C20.1 23.8 21 22.9 21 21.8V15.7C21 14.6 21.9 13.7 23 13.7C24.1 13.7 25 14.6 25 15.7V21.8C25 22.9 25.9 23.8 27 23.8C28.1 23.8 29 22.9 29 21.8V15.7C29.5 7.8 23.1 1.5 15.2 1.5Z"
        fill="#5841D8"
      />
    </svg>
  );
}

const HEADER_NAV_LINKS = [
  { label: "Dashboard", active: true, icon: LayoutDashboard, href: "/" },
  { label: "Intelligence Feed", active: false, icon: Database, href: "#" },
  { label: "Protocol Health", active: false, icon: Shield, href: "#" },
  { label: "Settlements", active: false, icon: Zap, href: "#" },
] as const;

const headerSearchFieldClass =
  "h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm font-normal leading-5 text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20";

const krakenMainSurfaceClassName =
  "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-6 custom-scrollbar bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent";

function KrakenHeaderNav({ className }: { className?: string }) {
  return (
    <nav className={cn("no-scrollbar flex items-center gap-6 overflow-x-auto", className)} aria-label="Primary navigation">
      {HEADER_NAV_LINKS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap py-1 text-sm font-medium tracking-[-0.006em] transition-colors",
              "min-h-11 lg:min-h-0 lg:py-0",
              item.active ? "text-white" : "text-muted-foreground hover:text-white",
            )}
          >
            <Icon size={14} className={cn("shrink-0", item.active ? "text-primary" : "")} />
            {item.label}
          </Link>
        );
      })}
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
        {/* Kraken header: Figma two-row (lg+); mobile = vertical bands + touch-friendly targets */}
        <header className="z-20 shrink-0 border-b border-border bg-background/50 backdrop-blur-xl">
          <>
          {/* Mobile */}
          <div className="flex flex-col gap-y-4 px-4 py-4 sm:px-6 lg:hidden">
            <div className="flex shrink-0 items-center">
              <KrakenLogoMark className="h-auto w-[min(151px,45vw)] max-w-[min(151px,45vw)]" />
            </div>
            <div className="relative min-w-0 w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={16} aria-hidden />
              <input
                type="text"
                placeholder="Search intelligence feed, wallets, or protocols..."
                className={headerSearchFieldClass}
              />
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <div className="min-w-0 max-w-[160px] shrink sm:max-w-[200px]">
                <EngineSubnetPicker
                  subnets={engineSubnets}
                  selectedSubnetId={dashboardSubnetId}
                  onSubnetChange={setDashboardSubnetId}
                  loading={engineSubnetsLoading}
                  error={engineSubnetsError}
                  menuAlign="start"
                />
              </div>
              <Link
                href="/intelligence-terminal"
                className="relative inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                title="Open Telegraph Intelligence Terminal"
              >
                <MessageSquare size={20} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
              </Link>
              <button
                type="button"
                className="relative inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-white"
              >
                <Bell size={20} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-background bg-primary" />
              </button>
              <div className="flex min-h-[44px] min-w-0 flex-1 flex-wrap items-center gap-2">
                {showGlobalWallet ? <GlobalWallet className="shrink-0" /> : null}
              </div>
            </div>
            <KrakenHeaderNav className="-mx-4 min-h-[44px] border-t border-border px-4 py-2 sm:-mx-6 sm:px-6" />
          </div>

          {/* Desktop (lg+): row1 logo | search | actions; row2 nav */}
          <div className="hidden min-w-0 flex-col lg:flex">
            <div className="flex min-h-[52px] items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-6 max-xl:flex-wrap xl:flex-nowrap">
              <div className="order-1 flex shrink-0 items-center">
                <KrakenLogoMark className="h-[26px] w-auto max-w-[151px]" />
              </div>
              <div className="order-2 flex min-w-0 flex-1 items-center justify-center px-2 sm:px-4 max-xl:order-3 max-xl:basis-full">
                <div className="relative w-full max-w-[469px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={16} aria-hidden />
                  <input
                    type="text"
                    placeholder="Search intelligence feed, wallets, or protocols..."
                    className={headerSearchFieldClass}
                  />
                </div>
              </div>
              <div className="order-3 flex max-xl:order-2 max-xl:ml-auto shrink-0 flex-nowrap items-center justify-end gap-2">
                <div className="min-w-0 max-w-[200px] shrink sm:max-w-[240px] lg:max-w-[280px] xl:max-w-[300px]">
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
                  className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  title="Open Telegraph Intelligence Terminal"
                >
                  <MessageSquare size={18} />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
                </Link>
                <button
                  type="button"
                  className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/30 hover:text-white"
                >
                  <Bell size={18} />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border-2 border-background bg-primary" />
                </button>
                <div className="flex shrink-0 items-center">
                  {showGlobalWallet ? <GlobalWallet className="shrink-0" /> : null}
                </div>
              </div>
            </div>
            <KrakenHeaderNav className="min-h-[44px] border-b border-border px-4 py-3 sm:px-6" />
          </div>
          </>
        </header>
        <main className={krakenMainSurfaceClassName}>
          <div className="max-w-[1440px] mx-auto flex flex-col gap-8 xl:flex-row">
            
            {/* Main Content (Left + Center) */}
            <div className="flex-1 flex flex-col gap-8 min-w-0">
              {/* Top Section: Feed */}
              <section className="flex flex-col gap-4">
                {feed.error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    Daemon read API error: {feed.error}
                  </div>
                )}
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
                      className="h-9 px-3 rounded-lg bg-muted/60 border border-border/50 text-xs text-foreground"
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
                      className="h-9 px-3 rounded-lg bg-muted/60 border border-border/50 text-xs text-foreground"
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
                    className="h-9 px-3 rounded-lg bg-muted/60 border border-border/50 text-xs text-muted-foreground hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none"
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
                      className="h-8 px-2 rounded border border-border/50 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={!feed.canGoNext || feed.isFetchingNextPage}
                      onClick={() => void feed.goToNextPage()}
                      className="h-8 px-2 rounded border border-border/50 disabled:opacity-40"
                    >
                      {feed.isFetchingNextPage ? "Loading…" : "Next"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4 xl:hidden" aria-label="Live alpha alerts">
                <KrakenAlerts alerts={feed.topAlerts} loading={feed.showTableSpinner && feed.topAlerts.length === 0} />
              </section>

              {/* Engine subnets from `/v1/subnets` (no static placeholder protocols) */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1.5 rounded-full bg-primary" />
                  <h2 className="text-xl font-bold tracking-tight text-white">Engine subnets</h2>
                </div>
                <KrakenSkillCards
                  engineSubnets={engineSubnets}
                  subnetsLoading={engineSubnetsLoading}
                  subnetsError={engineSubnetsError}
                />
              </section>

              {/* Bottom Section: Analytics */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h2 className="text-xl font-bold text-white tracking-tight">Protocol Efficiency</h2>
                </div>
                <KrakenAnalytics items={feed.signals} loading={feed.showTableSpinner} />
              </section>
            </div>

            {/* Right Sidebar (Alerts) */}
            <aside className="w-[420px] shrink-0 hidden xl:flex flex-col gap-6">
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

