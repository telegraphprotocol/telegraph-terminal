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
export const COLLECTOR_POOL_TARGET = 400;
export const ALERTS_LIMIT = 10;

export type DaemonSort = "recent" | "interest" | "affected" | "audience";

/** Daemon API accepts these category values; PHARMA/LAW are UI-only until backend adds them. */
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
  return isCollectorRow(item) && matchesSelectedCategories(item, selectedCategories);
}

/** Single known daemon category → API filter; otherwise client-side only. */
export function getApiCategoryParam(selected: ReadonlySet<string>): string | undefined {
  if (selected.size !== 1) return undefined;
  const only = [...selected][0];
  if (only === "PHARMA" || only === "LAW") return undefined;
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

/** Fetch collector-only rows (no category filter) for client-side checklist filtering. */
export async function fetchCollectorPool(
  fetchPage: (offset: number) => Promise<DaemonPage>,
  options: { targetCount: number; maxPages?: number },
): Promise<DaemonResultItem[]> {
  const maxPages = options.maxPages ?? 25;
  const accumulated: DaemonResultItem[] = [];
  const seenIds = new Set<string>();
  let apiOffset = 0;
  let pagesFetched = 0;

  while (accumulated.length < options.targetCount && pagesFetched < maxPages) {
    pagesFetched += 1;
    const page = await fetchPage(apiOffset);
    for (const row of page.results) {
      if (!isCollectorRow(row)) continue;
      if (row.id && seenIds.has(row.id)) continue;
      if (row.id) seenIds.add(row.id);
      accumulated.push(row);
      if (accumulated.length >= options.targetCount) break;
    }
    apiOffset += page.results.length;
    if (page.results.length === 0 || apiOffset >= page.total) break;
  }

  return dedupeSignalsById(accumulated);
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
