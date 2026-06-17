"use client";

import { KrakenCategoryFilter } from "@/components/kraken/kraken-category-filter";
import { KrakenFeed } from "@/components/kraken/kraken-feed";
import { KrakenSignalDetailsDialog } from "@/components/kraken/kraken-signal-details-dialog";
import { KrakenSkillCards } from "@/components/kraken/kraken-skill-cards";
import { KrakenAnalytics } from "@/components/kraken/kraken-analytics";
import { KrakenAlerts } from "@/components/kraken/kraken-alerts";
import { Search, Info, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { HowItWorksButton, type HowItWorksStep } from "@/components/how-it-works-button";
import { Radio, Zap, Cpu, DollarSign } from "lucide-react";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerId = useRef(`terminal-select-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, options.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt) { onChange(opt.value); setOpen(false); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, options, activeIndex, onChange]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        id={triggerId}
        className="flex h-9 items-center gap-2 border border-border bg-background pl-3 pr-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        {selected?.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-muted-foreground">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="listbox" aria-labelledby={triggerId} className="absolute left-0 top-full z-50 mt-1 min-w-full border border-border bg-background shadow-lg">
          {options.map((o, i) => (
            <button
              key={String(o.value)}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.1em] transition-colors hover:bg-muted hover:text-foreground",
                o.value === value ? "bg-muted text-foreground" : "text-muted-foreground",
                i === activeIndex && "ring-1 ring-inset ring-foreground/30",
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

const DASHBOARD_INFO_DISMISSED_KEY = "kraken-dashboard-info-dismissed";

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/60">{title}</p>
      <div className="text-[12px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function DashboardInfoPanel({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative border border-border/60 bg-muted/10 p-4 sm:p-5">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-2.5 pr-8">
        <div className="h-3 w-px bg-foreground/50" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          About the Signal Dashboard
        </h2>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-foreground/80">
        The Signal Dashboard is the live network explorer for Telegraph. It shows real-time
        questions being asked across the network, how they&apos;re routed, and how the answers
        are verified.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <InfoBlock title="What Drives Activity">
          Most of what you see comes from the network&apos;s own Autonomous Engine — an automated
          system that continuously tests miners and keeps the network active. External systems
          (trading bots, AI agents) also send requests; a sudden focus on one topic often signals
          where smart money is paying attention.
        </InfoBlock>

        <InfoBlock title="How You Can Use It">
          See what automated systems are actively paying to verify, track live network activity
          and cost, and explore the network before connecting your own tools.
        </InfoBlock>

        <InfoBlock title="Get Involved">
          Build against the network with the{" "}
          <Link href="https://docs.telegraphprotocol.com" target="_blank" rel="noopener noreferrer" className="text-foreground/80 underline hover:text-foreground">
            Developer APIs
          </Link>
          , or supply compute as a miner via{" "}
          <Link href="https://integrate.telegraphprotocol.com" target="_blank" rel="noopener noreferrer" className="text-foreground/80 underline hover:text-foreground">
            Integrate
          </Link>
          .
        </InfoBlock>
      </div>
    </div>
  );
}

const DASHBOARD_HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    icon: <Radio size={13} />,
    label: "Signal Feed",
    desc: "Completed questions and answers in real time, including timestamp, category, preview, source, and cost.",
  },
  {
    icon: <Zap size={13} />,
    label: "Live Alpha Alerts",
    desc: "Highlights high-interest or time-sensitive topics that are currently gaining traction.",
  },
  {
    icon: <Cpu size={13} />,
    label: "Active Miners",
    desc: "Specialized AI models and networks (such as Zeus, BitMind, or OpenAI) that are performing well right now.",
  },
  {
    icon: <DollarSign size={13} />,
    label: "Cost Efficiency Tracking",
    desc: "Compares the cost of using Telegraph versus running your own AI systems.",
  },
];

const headerSearchFieldClass =
  "h-9 w-full border border-border bg-input pl-9 pr-3 text-[12px] font-mono uppercase tracking-[0.06em] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-foreground/40 focus:outline-none";

const krakenMainSurfaceClassName =
  "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-6 custom-scrollbar bg-dot-grid";


export default function KrakenDashboard() {
  const [selectedCategories, setSelectedCategories] = useState<DashboardCategoryId[]>([
    ...DEFAULT_SELECTED_CATEGORIES,
  ]);
  const [infoOpen, setInfoOpen] = useState(false);
  useEffect(() => {
    setInfoOpen(localStorage.getItem(DASHBOARD_INFO_DISMISSED_KEY) !== "1");
  }, []);
  const dismissInfo = useCallback(() => {
    setInfoOpen(false);
    localStorage.setItem(DASHBOARD_INFO_DISMISSED_KEY, "1");
  }, []);
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
                <HowItWorksButton
                  title="How the Signal Dashboard Works"
                  intro="The Signal Dashboard is the live network explorer for Telegraph — it shows real-time questions being asked across the network, how they're routed, and how the answers are verified."
                  steps={DASHBOARD_HOW_IT_WORKS_STEPS}
                  footer="Most live activity comes from Telegraph's own Autonomous Engine continuously testing miners — external trading bots and AI agents add the rest."
                  className="min-h-[44px]"
                />
                <ThemeToggle />
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
                <HowItWorksButton
                  title="How the Signal Dashboard Works"
                  intro="The Signal Dashboard is the live network explorer for Telegraph — it shows real-time questions being asked across the network, how they're routed, and how the answers are verified."
                  steps={DASHBOARD_HOW_IT_WORKS_STEPS}
                  footer="Most live activity comes from Telegraph's own Autonomous Engine continuously testing miners — external trading bots and AI agents add the rest."
                />
                <ThemeToggle />
              </div>
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
                  {!infoOpen && (
                    <button
                      type="button"
                      onClick={() => setInfoOpen(true)}
                      aria-label="Show dashboard info"
                      title="What is the Signal Dashboard?"
                      className="text-muted-foreground/60 transition-colors hover:text-foreground"
                    >
                      <Info className="size-3.5" />
                    </button>
                  )}
                </div>
                {infoOpen && <DashboardInfoPanel onDismiss={dismissInfo} />}
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

