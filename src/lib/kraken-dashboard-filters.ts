import type { DaemonCategory, DaemonPage, DaemonResultItem } from "@/lib/engine-daemon-types";

/** All categories available in the multi-select checklist. */
export type DashboardCategoryId = "PHARMA" | "LAW" | DaemonCategory;

export const DEFAULT_SELECTED_CATEGORIES: DashboardCategoryId[] = [
  "POLITICS",
  "GEOPOLITICS",
  "PHARMA",
  "LAW",
];

/** Hours per sliding fetch window (newest window ends at now). */
export const FETCH_WINDOW_H = 5;
/** Auto catch-up mode total span when not using manual LAST 1H/6H/24H/72H. */
export const WINDOW_START_H = FETCH_WINDOW_H;
export const CATCHUP_LIMIT = 50;
/** Max offset pages per time window before moving to an older window. */
export const MAX_PAGES_PER_WINDOW = 30;
/** Collector rows cached per category selection (server-filtered queries). */
export const COLLECTOR_POOL_TARGET = 800;
export const ALERTS_LIMIT = 10;
/** Max daemon pages per progressive fetch. */
export const COLLECTOR_FETCH_MAX_PAGES = 120;

export type DaemonSort = "recent" | "interest" | "affected" | "audience";

/** Daemon API category values (includes native PHARMA / LAW on current daemon). */
export const DAEMON_API_CATEGORIES: DaemonCategory[] = [
  "POLITICS",
  "ECONOMICS",
  "GEOPOLITICS",
  "TECHNOLOGY",
  "CLIMATE",
  "HEALTH",
  "FINANCE",
  "CRYPTO",
  "SPORTS",
  "SCIENCE",
  "SOCIAL",
  "OTHER",
  "PHARMA",
  "LAW",
];

const CHECKLIST_TAIL = DAEMON_API_CATEGORIES.filter(
  (c) => c !== "POLITICS" && c !== "GEOPOLITICS" && c !== "PHARMA" && c !== "LAW",
) as DashboardCategoryId[];

export const CATEGORY_CHECKLIST_OPTIONS: DashboardCategoryId[] = [
  "POLITICS",
  "GEOPOLITICS",
  "PHARMA",
  "LAW",
  ...CHECKLIST_TAIL,
];

export function isSuccessRow(item: DaemonResultItem): boolean {
  return item.status === "success";
}

/** Stable list for React keys when API pagination returns overlapping rows. */
export function dedupeSignalsById(items: DaemonResultItem[]): DaemonResultItem[] {
  const seen = new Set<string>();
  const out: DaemonResultItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function normalizeCategory(item: DaemonResultItem): string {
  return (item.question.category || "").toUpperCase();
}

export function matchesSelectedCategories(
  item: DaemonResultItem,
  selected: ReadonlySet<string>,
): boolean {
  if (selected.size === 0) return false;
  return selected.has(normalizeCategory(item));
}

export function passesDashboardFilters(
  item: DaemonResultItem,
  selectedCategories: ReadonlySet<string>,
): boolean {
  return isSuccessRow(item) && matchesSelectedCategories(item, selectedCategories);
}

/** Comma-separated `category` for daemon OR filter; omit when all checklist options selected. */
export function buildApiCategoryParam(selected: ReadonlySet<string>): string | undefined {
  if (selected.size === 0) return undefined;
  const allSelected = CATEGORY_CHECKLIST_OPTIONS.every((c) => selected.has(c));
  if (allSelected) return undefined;
  const valid = [...selected]
    .filter((id) => CATEGORY_CHECKLIST_OPTIONS.includes(id as DashboardCategoryId))
    .sort();
  return valid.length > 0 ? valid.join(",") : undefined;
}

/** Success rows in pool (ignores category checklist). */
export function countFeedRowsInPool(pool: DaemonResultItem[]): number {
  let n = 0;
  for (const row of pool) {
    if (isSuccessRow(row)) n += 1;
  }
  return n;
}

/** Rows that pass feed filters (success + category OR). */
export function countDashboardFeedRowsInPool(
  pool: DaemonResultItem[],
  selectedCategories: ReadonlySet<string>,
): number {
  let n = 0;
  for (const row of pool) {
    if (passesDashboardFilters(row, selectedCategories)) n += 1;
  }
  return n;
}

/** Full UI span as one window (for status total queries). */
export function buildFullSpanWindow(
  totalSpanHours: number,
  now: Date = new Date(),
): TimeWindow {
  const endMs = now.getTime();
  return {
    since: new Date(endMs - totalSpanHours * 3_600_000).toISOString(),
    until: new Date(endMs).toISOString(),
  };
}

export type TimeWindow = {
  since: string;
  until: string;
};

/** Total history span covered by the feed (manual dropdown or 5h auto). */
export function resolveFeedSpanHours(
  useManualTimeRange: boolean,
  sinceHours: number,
): number {
  return useManualTimeRange ? sinceHours : WINDOW_START_H;
}

/** Sliding windows from now backward: [now-5h, now], [now-10h, now-5h], … */
export function buildSlidingWindows(
  totalSpanHours: number,
  windowHours: number = FETCH_WINDOW_H,
  now: Date = new Date(),
): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const endMs = now.getTime();
  const oldestMs = endMs - totalSpanHours * 3_600_000;
  const chunkMs = windowHours * 3_600_000;
  let untilMs = endMs;

  while (untilMs > oldestMs) {
    const sinceMs = Math.max(oldestMs, untilMs - chunkMs);
    windows.push({
      since: new Date(sinceMs).toISOString(),
      until: new Date(untilMs).toISOString(),
    });
    untilMs = sinceMs;
  }

  return windows;
}

export type WindowedPoolFetchResult = CollectorPoolFetchResult & {
  historyExhausted: boolean;
  nextWindowIndex: number;
  nextOffset: number;
  windowsScanned: number;
};

/**
 * Fetch collector rows in 5h (default) windows, newest first.
 * If a window does not yield enough feed rows, slide to the next older window.
 */
export async function fetchCollectorPoolByTimeWindows(
  fetchPage: (window: TimeWindow, offset: number) => Promise<DaemonPage>,
  options: {
    totalSpanHours: number;
    windowHours?: number;
    shouldStop?: (pool: DaemonResultItem[]) => boolean;
    targetCount?: number;
    startWindowIndex?: number;
    startOffset?: number;
    existing?: DaemonResultItem[];
    maxPagesPerWindow?: number;
    onProgress?: (pool: DaemonResultItem[]) => void;
  },
): Promise<WindowedPoolFetchResult> {
  const windows = buildSlidingWindows(options.totalSpanHours, options.windowHours);
  let pool = dedupeSignalsById(options.existing ?? []);
  const seenIds = new Set(pool.map((r) => r.id).filter(Boolean) as string[]);
  let apiOffset = options.startOffset ?? 0;
  let apiTotal = 0;
  let windowsScanned = 0;
  let historyExhausted = false;
  let nextWindowIndex = options.startWindowIndex ?? 0;
  let nextOffset = apiOffset;
  const maxPagesPerWindow = options.maxPagesPerWindow ?? MAX_PAGES_PER_WINDOW;

  for (let wi = nextWindowIndex; wi < windows.length; wi++) {
    const window = windows[wi]!;
    let pagesInWindow = 0;
    let windowExhausted = false;

    while (pagesInWindow < maxPagesPerWindow) {
      if (options.shouldStop?.(pool)) break;
      if (options.targetCount !== undefined && pool.length >= options.targetCount) break;

      pagesInWindow += 1;
      const page = await fetchPage(window, apiOffset);
      apiTotal = Math.max(apiTotal, page.total);
      const newRows = collectorRowsFromPage(page, seenIds);
      if (newRows.length > 0) {
        pool = mergeCollectorIntoPool(pool, newRows, { position: "append" });
        options.onProgress?.(pool);
      }
      apiOffset += page.results.length;
      if (page.results.length === 0 || apiOffset >= page.total) {
        windowExhausted = true;
        break;
      }
      if (options.shouldStop?.(pool)) break;
    }

    const windowEndOffset = apiOffset;
    windowsScanned += 1;

    if (options.shouldStop?.(pool)) {
      if (!windowExhausted) {
        nextWindowIndex = wi;
        nextOffset = windowEndOffset;
      } else {
        nextWindowIndex = wi + 1;
        nextOffset = 0;
      }
      break;
    }
    if (options.targetCount !== undefined && pool.length >= options.targetCount) break;
    if (!windowExhausted && pagesInWindow >= maxPagesPerWindow) {
      nextWindowIndex = wi;
      nextOffset = windowEndOffset;
      break;
    }

    apiOffset = 0;
    nextWindowIndex = wi + 1;
    nextOffset = 0;
  }

  if (nextWindowIndex >= windows.length) {
    historyExhausted = true;
    nextWindowIndex = windows.length;
    nextOffset = 0;
  }

  const stoppedEarlyForFeed =
    Boolean(options.shouldStop?.(pool)) && nextWindowIndex < windows.length;

  return {
    pool,
    apiOffset: nextOffset,
    apiTotal,
    exhausted: historyExhausted && !stoppedEarlyForFeed,
    historyExhausted,
    nextWindowIndex,
    nextOffset,
    windowsScanned,
  };
}

export type FetchFilteredResult = {
  items: DaemonResultItem[];
  filteredTotal: number;
  hasMore: boolean;
};

export function sortDaemonSignals(items: DaemonResultItem[], sort: DaemonSort): DaemonResultItem[] {
  const copy = [...items];
  switch (sort) {
    case "interest":
      return copy.sort((a, b) => b.question.interest_score - a.question.interest_score);
    case "affected":
      return copy.sort((a, b) => b.question.affected_pct - a.question.affected_pct);
    case "audience":
      return copy.sort((a, b) => b.question.audience_pct - a.question.audience_pct);
    case "recent":
    default:
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

/** Filter + sort + paginate cached collector rows (no network). */
export function buildFeedViewFromPool(
  pool: DaemonResultItem[],
  selectedCategories: ReadonlySet<string>,
  sort: DaemonSort,
  skipFiltered: number,
  pageSize: number,
): FetchFilteredResult {
  if (selectedCategories.size === 0) {
    return { items: [], filteredTotal: 0, hasMore: false };
  }
  const filtered = sortDaemonSignals(
    pool.filter((row) => passesDashboardFilters(row, selectedCategories)),
    sort,
  );
  const items = filtered.slice(skipFiltered, skipFiltered + pageSize);
  return {
    items,
    filteredTotal: filtered.length,
    hasMore: skipFiltered + pageSize < filtered.length,
  };
}

export function topAlertsFromPool(
  pool: DaemonResultItem[],
  selectedCategories: ReadonlySet<string>,
  limit: number,
): DaemonResultItem[] {
  if (selectedCategories.size === 0) return [];
  return sortDaemonSignals(
    pool.filter((row) => passesDashboardFilters(row, selectedCategories)),
    "interest",
  ).slice(0, limit);
}

export type CollectorPoolFetchResult = {
  pool: DaemonResultItem[];
  apiOffset: number;
  apiTotal: number;
  exhausted: boolean;
};

export type MergeCollectorPosition = "prepend" | "append";

/** Merge collector rows into pool with dedupe; cap defaults to COLLECTOR_POOL_TARGET. */
export function mergeCollectorIntoPool(
  existing: DaemonResultItem[],
  newRows: DaemonResultItem[],
  options?: { cap?: number; position?: MergeCollectorPosition },
): DaemonResultItem[] {
  const cap = options?.cap ?? COLLECTOR_POOL_TARGET;
  const position = options?.position ?? "append";
  const combined =
    position === "prepend" ? [...newRows, ...existing] : [...existing, ...newRows];
  return dedupeSignalsById(combined).slice(0, cap);
}

function collectorRowsFromPage(
  page: DaemonPage,
  seenIds: Set<string>,
): DaemonResultItem[] {
  const rows: DaemonResultItem[] = [];
  for (const row of page.results) {
    if (!isSuccessRow(row)) continue;
    if (row.id && seenIds.has(row.id)) continue;
    if (row.id) seenIds.add(row.id);
    rows.push(row);
  }
  return rows;
}

/** Progressive pool fetch with optional per-page callback (Phase A / B). */
export async function fetchCollectorPoolProgressive(
  fetchPage: (offset: number) => Promise<DaemonPage>,
  options: {
    /** Stop after this many collector rows (Phase B). */
    targetCount?: number;
    /** Stop when true (Phase A: first screen has enough visible rows). */
    shouldStop?: (pool: DaemonResultItem[]) => boolean;
    startOffset?: number;
    existing?: DaemonResultItem[];
    maxPages?: number;
    onProgress?: (pool: DaemonResultItem[]) => void;
  },
): Promise<CollectorPoolFetchResult> {
  const maxPages = options.maxPages ?? COLLECTOR_FETCH_MAX_PAGES;
  let pool = dedupeSignalsById(options.existing ?? []);
  const seenIds = new Set(pool.map((r) => r.id).filter(Boolean) as string[]);
  let apiOffset = options.startOffset ?? 0;
  let apiTotal = 0;
  let pagesFetched = 0;
  let exhausted = false;

  while (pagesFetched < maxPages) {
    if (options.shouldStop?.(pool)) break;
    if (options.targetCount !== undefined && pool.length >= options.targetCount) break;

    pagesFetched += 1;
    const page = await fetchPage(apiOffset);
    apiTotal = page.total;
    const newRows = collectorRowsFromPage(page, seenIds);
    if (newRows.length > 0) {
      pool = mergeCollectorIntoPool(pool, newRows, { position: "append" });
      options.onProgress?.(pool);
    }
    apiOffset += page.results.length;
    if (page.results.length === 0 || apiOffset >= page.total) {
      exhausted = apiOffset >= page.total;
      break;
    }
    if (options.shouldStop?.(pool)) break;
  }

  if (!exhausted && apiOffset < apiTotal) {
    const hitCollectorTarget =
      options.targetCount !== undefined && pool.length >= options.targetCount;
    const hitVisibleTarget = options.shouldStop?.(pool) ?? false;
    if (!hitCollectorTarget && !hitVisibleTarget) exhausted = false;
  }

  return { pool, apiOffset, apiTotal, exhausted };
}

/** Fetch collector-only rows for client-side checklist filtering. */
export async function fetchCollectorPool(
  fetchPage: (offset: number) => Promise<DaemonPage>,
  options: { targetCount: number; maxPages?: number },
): Promise<DaemonResultItem[]> {
  const result = await fetchCollectorPoolProgressive(fetchPage, {
    targetCount: options.targetCount,
    maxPages: options.maxPages,
  });
  return result.pool;
}

/** Poll: newest API page only (offset 0). */
export async function fetchLatestCollectorPage(
  fetchPage: (offset: number) => Promise<DaemonPage>,
): Promise<{ rows: DaemonResultItem[]; apiTotal: number }> {
  const page = await fetchPage(0);
  const seenIds = new Set<string>();
  return {
    rows: collectorRowsFromPage(page, seenIds),
    apiTotal: page.total,
  };
}

/** On-demand: next collector page(s), skipping API pages with no collector rows. */
export async function fetchNextWindowedCollectorPage(
  fetchPage: (window: TimeWindow, offset: number) => Promise<DaemonPage>,
  options: { totalSpanHours: number; windowIndex: number; offset: number; maxSkips?: number },
): Promise<{
  rows: DaemonResultItem[];
  nextWindowIndex: number;
  nextOffset: number;
  apiTotal: number;
  exhausted: boolean;
}> {
  const windows = buildSlidingWindows(options.totalSpanHours);
  let wi = options.windowIndex;
  let offset = options.offset;
  let lastTotal = 0;
  const maxSkips = options.maxSkips ?? 40;

  for (let skip = 0; skip < maxSkips && wi < windows.length; skip += 1) {
    const page = await fetchPage(windows[wi]!, offset);
    lastTotal = page.total;
    const seenIds = new Set<string>();
    const rows = collectorRowsFromPage(page, seenIds);
    const nextOffset = offset + page.results.length;
    const windowDone = page.results.length === 0 || nextOffset >= page.total;

    if (rows.length > 0) {
      return {
        rows,
        nextWindowIndex: windowDone ? wi + 1 : wi,
        nextOffset: windowDone ? 0 : nextOffset,
        apiTotal: lastTotal,
        exhausted: windowDone && wi + 1 >= windows.length,
      };
    }

    if (windowDone) {
      wi += 1;
      offset = 0;
      skip = -1;
      continue;
    }

    offset = nextOffset;
  }

  return {
    rows: [],
    nextWindowIndex: wi >= windows.length ? windows.length : wi,
    nextOffset: offset,
    apiTotal: lastTotal,
    exhausted: wi >= windows.length,
  };
}

export type DaemonStatusTotals = {
  successTotal: number;
  errorTotal: number;
  rangeTotal: number;
  scannedAll: boolean;
};

/** Count ok/failed by scanning API pages (status filtered on the client). */
export async function countDaemonStatusTotalsFromPages(
  fetchPage: (offset: number) => Promise<DaemonPage>,
  options?: { maxPages?: number },
): Promise<DaemonStatusTotals> {
  const maxPages = options?.maxPages ?? 50;
  let successTotal = 0;
  let errorTotal = 0;
  let offset = 0;
  let rangeTotal = 0;

  for (let pageNum = 0; pageNum < maxPages; pageNum += 1) {
    const page = await fetchPage(offset);
    rangeTotal = page.total;
    for (const row of page.results) {
      if (row.status === "error") errorTotal += 1;
      else if (row.status === "success") successTotal += 1;
    }
    offset += page.results.length;
    if (page.results.length === 0 || offset >= page.total) {
      return { successTotal, errorTotal, rangeTotal, scannedAll: true };
    }
  }

  return { successTotal, errorTotal, rangeTotal, scannedAll: false };
}

/** On-demand: one API page at the current daemon offset. */
export async function fetchNextCollectorPage(
  fetchPage: (offset: number) => Promise<DaemonPage>,
  apiOffset: number,
): Promise<{
  rows: DaemonResultItem[];
  nextOffset: number;
  apiTotal: number;
  exhausted: boolean;
}> {
  const page = await fetchPage(apiOffset);
  const seenIds = new Set<string>();
  const rows = collectorRowsFromPage(page, seenIds);
  const nextOffset = apiOffset + page.results.length;
  const exhausted = page.results.length === 0 || nextOffset >= page.total;
  return { rows, nextOffset, apiTotal: page.total, exhausted };
}

/**
 * Fetches API pages until `targetCount` collector+category matches or API exhausted.
 */
export async function fetchFilteredCollectorSignals(
  fetchPage: (offset: number) => Promise<DaemonPage>,
  selectedCategories: ReadonlySet<string>,
  options: {
    targetCount: number;
    skipFiltered: number;
    pageSize?: number;
  },
): Promise<FetchFilteredResult> {
  if (selectedCategories.size === 0) {
    return { items: [], filteredTotal: 0, hasMore: false };
  }

  const targetCount = options.targetCount;
  const accumulated: DaemonResultItem[] = [];
  const seenIds = new Set<string>();
  let apiOffset = 0;
  let scannedAll = false;
  let skipped = 0;
  let matchedTotal = 0;

  let pagesFetched = 0;
  const maxPages = 40;

  while (accumulated.length < targetCount && pagesFetched < maxPages) {
    pagesFetched += 1;
    const page = await fetchPage(apiOffset);

    for (const row of page.results) {
      if (!passesDashboardFilters(row, selectedCategories)) continue;
      if (row.id && seenIds.has(row.id)) continue;
      matchedTotal += 1;
      if (skipped < options.skipFiltered) {
        skipped += 1;
        continue;
      }
      if (row.id) seenIds.add(row.id);
      accumulated.push(row);
      if (accumulated.length >= targetCount) break;
    }

    apiOffset += page.results.length;
    if (page.results.length === 0 || apiOffset >= page.total) {
      scannedAll = apiOffset >= page.total;
      break;
    }
  }

  const filteredTotal = scannedAll
    ? matchedTotal
    : Math.max(matchedTotal, options.skipFiltered + accumulated.length + 1);
  const hasMore = scannedAll
    ? options.skipFiltered + accumulated.length < matchedTotal
    : true;

  return {
    items: dedupeSignalsById(accumulated).slice(0, targetCount),
    filteredTotal,
    hasMore,
  };
}
