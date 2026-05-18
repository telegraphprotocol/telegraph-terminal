# Kraken dashboard — feed loading (single cache model)

How the intelligence feed loads, paginates, and refreshes. Implementation: [`use-kraken-collector-cache.ts`](../src/lib/use-kraken-collector-cache.ts), [`page.tsx`](../src/app/page.tsx), [`kraken-dashboard-filters.ts`](../src/lib/kraken-dashboard-filters.ts).

For table columns and signal details, see [`kraken-dashboard-ui.md`](kraken-dashboard-ui.md).

## Three concepts

```text
Daemon API  →  cache (≤2000 collector rows)  →  view (filter + sort)  →  page slice (50 rows)
```

| Layer | What it is |
| ----- | ---------- |
| **Cache** | In-memory collector rows (deduped by `id`, max `COLLECTOR_POOL_TARGET` = 2000). Built from daemon `/api/questions` without server-side category filter. |
| **View** | OR filter on expanded categories + `sort` over the cache. Recomputed instantly when checkboxes change. |
| **Page** | `pageIndex` 0, 1, 2… → `view.slice(pageIndex × 50, pageIndex × 50 + 50)`. |

### Time range

- **Default:** `useManualTimeRange` is `true` on first load, so the LAST 24H dropdown sends **`since_hours: 24`** immediately.
- **Auto catch-up:** When `useManualTimeRange` is `false`, requests use **`since_hours: 5`** (`WINDOW_START_H`) regardless of the dropdown label until the user changes the time control.

### Category filter (client-side OR)

Checklist selections use **OR** logic: a row matches if `question.category` is in the **expanded** set for any checked box.

UI buckets map to daemon categories via `CATEGORY_ALIASES` in [`kraken-dashboard-filters.ts`](../src/lib/kraken-dashboard-filters.ts):

| UI checkbox | Matches daemon `question.category` |
| ----------- | ------------------------------------ |
| `PHARMA` | `HEALTH` |
| `LAW` | `POLITICS`, `ECONOMICS` |
| Other labels | Same string (e.g. `GEOPOLITICS` → `GEOPOLITICS`) |

Default selection: `POLITICS`, `GEOPOLITICS`, `PHARMA`, `LAW` (see `DEFAULT_SELECTED_CATEGORIES`).

### `min_interest`

Optional. When `NEXT_PUBLIC_KRAKEN_MIN_INTEREST` is unset, daemon queries **omit** `min_interest`. Set to `1` in `.env` to restore the previous server-side floor.

## Load pipeline

One hook owns all fetching (`resetAndBootstrap`):

1. **Bootstrap** (`status: bootstrapping`) — Fetch API pages until **50 visible** rows (after category filter) or API exhausted. Updates cache after each page so the feed grows 1 → 50 on page 0.
2. **Background** (`status: background`) — Continue until **2000** collectors or API exhausted. Does not change `pageIndex`.
3. **Poll** (interval) — Fetch offset 0 only; prepend new rows into cache.
4. **Next gap fill** — If user/timer needs the next page but the cache has no slice yet, fetch **one** API page and append.

**Category change:** Re-filter view only; **no** refetch.

**Sort or time range change:** `resetAndBootstrap()` (cache cleared, `pageIndex` → 0).

## Pagination

- **Prev:** `pageIndex--` (no network).
- **Next:** If the next slice is in the cache, `pageIndex++`. Otherwise one API page, then `pageIndex++`.
- **Auto-advance:** Timer on **page 0 only**, after the first screen is full (≥50 visible or API exhausted with some results). Pauses when `pageIndex > 0`; resumes when user **Prev** back to page 0.

## Environment variables

Set in [`.env`](../.env) / [`.env.example`](../.env.example). Exposed via [`next.config.ts`](../next.config.ts). **Restart the dev server** after changes.

```env
KRAKEN_FEED_POLL_INTERVAL_MS=180000
KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS=180000
# NEXT_PUBLIC_KRAKEN_MIN_INTEREST=1
```

| Variable | Default | Role |
| -------- | ------- | ---- |
| `KRAKEN_FEED_POLL_INTERVAL_MS` | `180000` (3 min) | Poll: merge newest page into cache |
| `KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS` | `180000` (3 min) | Auto-advance from batch 1 → 2 on page 0 |
| `NEXT_PUBLIC_KRAKEN_MIN_INTEREST` | *(unset)* | Optional daemon `min_interest` (0–10); omit = no filter |

Keep **catch-up interval ≫ poll interval** (e.g. dev: `10000` poll + `180000` catch-up).

## UI status

| Signal | Meaning |
| ------ | ------- |
| Table spinner | Bootstrap and zero visible rows |
| `filling X/50` | Bootstrap in progress on page 0 |
| `loading more…` | Background fill toward 2000 |
| `auto-advance paused` | User on batch 2+ |

## Footer counts

The feed footer (see [`page.tsx`](../src/app/page.tsx)) shows three layers:

```text
Showing {pageRows} of {filteredTotal} filtered · {cacheSize} in cache · {daemonTotal} daemon
```

| Segment | Meaning |
| ------- | ------- |
| `pageRows` / `filteredTotal` | Current page slice vs all rows matching category OR + collector filter in cache |
| `cacheSize` | Collector rows loaded into memory (≤ 2000) |
| `daemonTotal` | Raw `total` from the daemon for the active time/sort query (before client category filter) |

## Constants (code)

| Name | Value |
| ---- | ----- |
| `CATCHUP_LIMIT` | 50 rows per page |
| `COLLECTOR_POOL_TARGET` | 2000 max cache size |
| `COLLECTOR_FETCH_MAX_PAGES` | 120 max API pages per progressive fetch |
| `WINDOW_START_H` | 5 hours in auto mode |
| `CATEGORY_ALIASES` | PHARMA→HEALTH, LAW→POLITICS+ECONOMICS (OR with other selected categories) |
| `NEXT_PUBLIC_KRAKEN_MIN_INTEREST` | Optional; omit = no `min_interest` filter |
