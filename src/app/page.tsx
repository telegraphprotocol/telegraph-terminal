"use client";

import { KrakenCategoryFilter } from "@/components/kraken/kraken-category-filter";
import { KrakenFeed } from "@/components/kraken/kraken-feed";
import { KrakenSignalDetailsDialog } from "@/components/kraken/kraken-signal-details-dialog";
import { KrakenSkillCards } from "@/components/kraken/kraken-skill-cards";
import { KrakenAnalytics } from "@/components/kraken/kraken-analytics";
import { KrakenAlerts } from "@/components/kraken/kraken-alerts";
import { Search, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

function TerminalSelect<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 border border-border bg-background pl-3 pr-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground/40 focus:outline-none"
      >
        {selected?.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-muted-foreground">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-full border border-border bg-background shadow-lg">
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] transition-colors hover:bg-muted hover:text-foreground",
                o.value === value ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function KrakenLogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <img src="/logo.png" alt="Telegraph" className="h-full w-auto object-contain" />
      <span className="text-[11px] font-bold tracking-[0.2em] text-foreground">TELEGRAPH</span>
    </div>
  );
}

const HEADER_NAV_LINKS = [
  { label: "Dashboard", active: true, href: "/" },
  { label: "Intelligence Feed", active: false, href: "#" },
  { label: "Protocol Health", active: false, href: "#" },
  { label: "Settlements", active: false, href: "#" },
] as const;

const headerSearchFieldClass =
  "h-9 w-full border border-border bg-input pl-9 pr-3 text-[12px] font-mono uppercase tracking-[0.06em] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-foreground/40 focus:outline-none";

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
                </Link>
                <ThemeToggle />
                {showGlobalWallet && <GlobalWallet className="shrink-0" />}
              </div>
            </div>

            {/* Row 2: search */}
            <div className="relative border-t border-border/30 px-4 sm:px-5">
              <Search className="pointer-events-none absolute left-7 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/70" size={14} aria-hidden />
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
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/70" size={14} aria-hidden />
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
                </Link>

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
                    <TerminalSelect
                      value={sort}
                      options={[
                        { value: "recent", label: "RECENT" },
                        { value: "interest", label: "INTEREST" },
                        { value: "affected", label: "AFFECTED" },
                        { value: "audience", label: "AUDIENCE" },
                      ]}
                      onChange={(v) => { setSort(v as typeof sort); feed.resetPageIndex(); }}
                    />
                    <TerminalSelect
                      value={sinceHours}
                      options={[
                        { value: 1, label: "LAST 1H" },
                        { value: 6, label: "LAST 6H" },
                        { value: 24, label: "LAST 24H" },
                        { value: 72, label: "LAST 72H" },
                      ]}
                      onChange={(v) => { setSinceHours(v as number); setUseManualTimeRange(true); feed.resetPageIndex(); }}
                    />
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

