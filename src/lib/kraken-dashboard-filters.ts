import type { DaemonCategory, DaemonPage, DaemonQueryParams, DaemonResultItem } from "@/lib/engine-daemon-types";

/** All categories available in the multi-select checklist. */
export type DashboardCategoryId = "PHARMA" | "LAW" | DaemonCategory;

export const DEFAULT_SELECTED_CATEGORIES: DashboardCategoryId[] = [
  "POLITICS",
  "GEOPOLITICS",
  "PHARMA",
  "LAW",
];

export const COLLECTOR_SOURCES = ["reddit", "gdelt", "polymarket", "hackernews", "openmeteo"] as const;

export const WINDOW_START_H = 5;
export const CATCHUP_LIMIT = 50;
/** Collector rows cached for instant category toggles. */
export const COLLECTOR_POOL_TARGET = 2000;
export const ALERTS_LIMIT = 10;
/** Max daemon pages per progressive fetch (50 rows/page → enough headroom for 2k collectors). */
export const COLLECTOR_FETCH_MAX_PAGES = 120;

export type DaemonSort = "recent" | "interest" | "affected" | "audience";

/** UI buckets → daemon categories (OR within each bucket). */
export const CATEGORY_ALIASES: Partial<Record<DashboardCategoryId, readonly DaemonCategory[]>> = {
  PHARMA: ["HEALTH"],
  LAW: ["POLITICS", "ECONOMICS"],
};

/** Daemon API accepts these category values. */
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
];

const CHECKLIST_TAIL = DAEMON_API_CATEGORIES.filter(
  (c) => c !== "POLITICS" && c !== "GEOPOLITICS",
) as DashboardCategoryId[];

export const CATEGORY_CHECKLIST_OPTIONS: DashboardCategoryId[] = [
  "POLITICS",
  "GEOPOLITICS",
  "PHARMA",
  "LAW",
  ...CHECKLIST_TAIL,
];

export function isCollectorRow(item: DaemonResultItem): boolean {
  return item.source !== "user" && (COLLECTOR_SOURCES as readonly string[]).includes(item.source);
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

/** Expand UI selections (e.g. PHARMA → HEALTH) for OR matching. */
export function expandSelectedCategories(selected: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const id of selected) {
    const aliases = CATEGORY_ALIASES[id as DashboardCategoryId];
    if (aliases?.length) {
      for (const c of aliases) out.add(c);
    } else {
      out.add(id);
    }
  }
  return out;
}

export function matchesSelectedCategories(
  item: DaemonResultItem,
  selected: ReadonlySet<string>,
): boolean {
  if (selected.size === 0) return false;
  const expanded = expandSelectedCategories(selected);
  return expanded.has(normalizeCategory(item));
}

export function passesDashboardFilters(
  item: DaemonResultItem,
  selectedCategories: ReadonlySet<string>,
): boolean {
  return isCollectorRow(item) && matchesSelectedCategories(item, selectedCategories);
}

/** Single known daemon category → API filter; UI buckets with aliases use client-side filter only. */
export function getApiCategoryParam(selected: ReadonlySet<string>): string | undefined {
  if (selected.size !== 1) return undefined;
  const only = [...selected][0];
  if (only in CATEGORY_ALIASES) return undefined;
  if ((DAEMON_API_CATEGORIES as readonly string[]).includes(only)) return only;
  return undefined;
}

/** Last N hours for feed/alerts; catch-up mode always uses WINDOW_START_H. */
export function buildTimeQueryParams(
  useManualTimeRange: boolean,
  sinceHours: number,
): Pick<DaemonQueryParams, "since_hours"> {
  return { since_hours: useManualTimeRange ? sinceHours : WINDOW_START_H };
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
    pool.filter((row) => matchesSelectedCategories(row, selectedCategories)),
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
    pool.filter((row) => matchesSelectedCategories(row, selectedCategories)),
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
    if (!isCollectorRow(row)) continue;
    if (row.id && seenIds.has(row.id)) continue;
    if (row.id) seenIds.add(row.id);
    rows.push(row);
  }
  return rows;
}

/** Visible row count on batch 1 (skip 0) for progressive first-screen fill. */
export function firstScreenVisibleCount(
  pool: DaemonResultItem[],
  selectedCategories: ReadonlySet<string>,
  sort: DaemonSort,
): number {
  return buildFeedViewFromPool(pool, selectedCategories, sort, 0, CATCHUP_LIMIT).items.length;
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

/** Fetch collector-only rows (no category filter) for client-side checklist filtering. */
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
