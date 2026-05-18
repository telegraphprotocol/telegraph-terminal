# Kraken dashboard UI (Telegraph terminal)

This document describes the Kraken intelligence dashboard UI in the Next.js app (`/` → [`src/app/page.tsx`](../src/app/page.tsx)), the feed and supporting components, and related utilities.

## Data flow

1. **Daemon read API** — The browser calls same-origin **`/api/daemon/*`** (see [`api-client.ts`](../src/lib/api-client.ts)); Next proxies to the daemon using **`DAEMON_INTERNAL_URL`** (default `http://127.0.0.1:8081`). The dashboard loads `/api/daemon/api/questions` with RFC3339 `since`/`until` (5h sliding windows), comma-separated `category` (OR) when the checklist is not “All”, `sort`, `order`, `limit`, `offset`, and optional `min_interest`. Success and category are applied on the client. State and fetching live in [`use-kraken-collector-cache.ts`](../src/lib/use-kraken-collector-cache.ts). Health: `/api/daemon/health`.
2. **Cache + feed view** — See **[`kraken-dashboard-feed-loading.md`](kraken-dashboard-feed-loading.md)** for staged loading (incremental first 50 rows), polling, pagination, auto-advance, footer metrics, and **`KRAKEN_FEED_*`** env vars.
3. **Feed scope** — All daemon sources (`clinicaltrials`, `openfda`, `reddit`, etc.) may appear when `status === "success"` and the row’s category is checked. There is no `COLLECTOR_SOURCES` allowlist.
4. **Engine catalog** — [`GET /v1/subnets`](../src/lib/api-client.ts) via **`/api/engine/v1/subnets`**; Next proxies to the engine using **`ENGINE_INTERNAL_URL`** (default `http://127.0.0.1:7044`). This feeds the header subnet picker and [`KrakenSkillCards`](../src/components/kraken/kraken-skill-cards.tsx). This is independent of the daemon feed.

## Category filter (`KrakenCategoryFilter`)

**File:** [`src/components/kraken/kraken-category-filter.tsx`](../src/components/kraken/kraken-category-filter.tsx)

- Multi-select checklist; **All** / **Clear** shortcuts.
- Matching is **OR** across checked boxes (any selected category bucket can match).
- **`PHARMA`** and **`LAW`** are native daemon categories; the app sends them in the comma-separated `category` query param.
- Changing categories, sort, or time range reloads the cache from the daemon.

## Success-only policy

The feed and alerts show only `status === "success"` signals. Filtering is done on the client in [`kraken-dashboard-filters.ts`](../src/lib/kraken-dashboard-filters.ts) (`collectorRowsFromPage`, `passesDashboardFilters`).

## Time range control

Dropdown: LAST 1H / 6H / 24H / 72H. Default **`useManualTimeRange: true`** so the initial load uses **24 hours**. Changing the dropdown sets manual mode and calls `resetPageIndex()`.

## Feed footer and pagination

Below the table:

- **Footer:** `Showing {n} of {filteredTotal} feed · {cacheSize} cached · {daemonTotal} daemon` plus optional status (`batch N`, `loading more…`, etc.). See **[`kraken-dashboard-feed-loading.md`](kraken-dashboard-feed-loading.md#footer-counts)** for how each number is derived and curl checks.
- **Prev / Next:** Slice the filtered view (50 rows per page). **Next** may fetch another daemon page when the cache slice is exhausted but the API is not.

## Feed table (`KrakenFeed`)

**File:** [`src/components/kraken/kraken-feed.tsx`](../src/components/kraken/kraken-feed.tsx)

| Column        | Source (TypeScript)          | Notes                                                                                                                                                               |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TIMESTAMP     | `created_at`                 | Local time string.                                                                                                                                                  |
| INTENT        | `routing.intent` or fallback | [`formatKrakenIntentCell`](../src/lib/kraken-signal-format.ts): if `routing.intent` is non-empty, show it; else show `routing.subnet_name` and optional `(SN{id})`. |
| INPUT SNIPPET | `question.text`              | Truncated in grid.                                                                                                                                                  |
| STATUS        | `status`                     | `success` / `error` badges; unknown values get a neutral “Unknown” badge.                                                                                           |
| COST          | `execution.cost_usd`         | Formatted with `Number(… \|\| 0).toFixed(4)`.                                                                                                                       |
| SOURCE        | `source`                     | Plain text; copy button copies the source string only (does not open details).                                                                                      |
| PROOF         | Receipt icon                 | Tooltip: `execution.error`, else `routing.reasoning`, else a default hint. Icon is not interactive for opening the modal.                                           |
| (last column) | —                            | Chevron button opens signal details when `onRowSelect` is provided.                                                                                                 |

**Interaction rules**

- **Row body is not a single large click target.** Opening details is intentional only via the **chevron** button (avoids accidental opens when clicking SOURCE or elsewhere).
- **SOURCE copy** — `navigator.clipboard.writeText(log.source)` with `stopPropagation` on the button.

**Grid layout** — Eight columns: `grid-cols-[110px_1fr_150px_130px_90px_130px_60px_40px]` plus header row aligned with [`FEED_HEADERS`](../src/components/kraken/kraken-feed.tsx).

## Export CSV

**Files:** [`src/lib/export-signals-csv.ts`](../src/lib/export-signals-csv.ts), wired from [`src/app/page.tsx`](../src/app/page.tsx).

- **Scope:** Exports the **current in-memory `signals` array** (the filtered feed rows for the active page), not the full daemon result set across all pages.
- **Filename:** `kraken-signals-<UTC-timestamp>.csv`.
- **Columns:** `id`, `created_at`, `intent` (same string as the feed intent column), `question_text`, `category`, `interest_score`, `status`, `error`, `cost_usd`, `source`, `type`, `subnet_id`, `subnet_name`, `routing_reasoning`, `error_stage`, `duration_ms`, `execution_timestamp`. Header names use API field semantics where applicable (`subnet_*` match JSON from `/api/questions`).
- **Escaping:** RFC4180-style quoting for fields containing comma, quote, or newline.
- **Button state:** Disabled when `signals.length === 0`.

## Signal details modal

**File:** [`src/components/kraken/kraken-signal-details-dialog.tsx`](../src/components/kraken/kraken-signal-details-dialog.tsx)

- **Open/close:** Controlled from the dashboard page: `detailsItem: DaemonResultItem | null`. Backdrop click and **Escape** close the dialog.
- **Layout:** Card uses `max-h-[min(92vh,800px)]` with `flex flex-col overflow-hidden`. Scrollable body uses **`overflow-y-auto`** and `max-h-[calc(92vh-7rem)]` so long questions and execution errors scroll reliably (replacing an earlier `ScrollArea`-only approach that could clip content).
- **Sections:** Created, type, source, status, intent (formatted cell); Question (full text and scores); Routing (**Miner ID** / **Miner name** labels map to `routing.subnet_id` / `routing.subnet_name` in the API payload); Execution; **Result (JSON)** with pretty-printed `execution.result` or literal `null`.
- **Copy JSON:** A single **Copy JSON** control lives in the **Result (JSON)** section header (not in the dialog title bar). It copies the same string shown in the `<pre>` block (`null` or `JSON.stringify(result, null, 2)`). Clipboard API absence disables the button. Brief “Copied” label feedback after success.

## Supporting modules

| File                                                                                              | Role                                                                          |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`src/lib/kraken-signal-format.ts`](../src/lib/kraken-signal-format.ts)                           | `formatKrakenIntentCell(item)` for feed and CSV intent column.                |
| [`src/lib/kraken-dashboard-filters.ts`](../src/lib/kraken-dashboard-filters.ts)                 | Category OR, sliding windows, pool merge, feed filters (success + category).   |
| [`src/lib/use-kraken-collector-cache.ts`](../src/lib/use-kraken-collector-cache.ts)               | Feed cache hook: bootstrap, poll, pagination, footer metrics.                 |
| [`src/lib/kraken-dashboard-config.ts`](../src/lib/kraken-dashboard-config.ts)                   | Poll/catch-up intervals, optional `KRAKEN_MIN_INTEREST`.                      |
| [`src/lib/engine-daemon-types.ts`](../src/lib/engine-daemon-types.ts)                             | `DaemonResultItem` and related types aligned with daemon `SubnetResult` JSON. |
| [`src/components/kraken/kraken-alerts.tsx`](../src/components/kraken/kraken-alerts.tsx)           | Live alpha alerts from top signals.                                           |
| [`src/components/kraken/kraken-analytics.tsx`](../src/components/kraken/kraken-analytics.tsx)     | Charts from current feed slice.                                               |
| [`src/components/kraken/kraken-skill-cards.tsx`](../src/components/kraken/kraken-skill-cards.tsx) | Engine subnet cards from `/v1/subnets`.                                       |

## Environment

See [`.env`](../.env) (or [`.env.example`](../.env.example)) for:

- **`DAEMON_INTERNAL_URL`** — Next server → daemon HTTP (browser uses `/api/daemon/*`).
- **`ENGINE_INTERNAL_URL`** — Next server → engine HTTP (browser uses `/api/engine/*`).
- **`NEXT_PUBLIC_ENGINE_WS_URL`** — Browser → engine WebSocket (still direct; not proxied by Next).
- **`KRAKEN_FEED_POLL_INTERVAL_MS`**, **`KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS`** — Feed poll and auto-advance intervals.
- **`NEXT_PUBLIC_KRAKEN_MIN_INTEREST`** — Optional daemon interest floor (omit = no filter).

Details: [`kraken-dashboard-feed-loading.md`](kraken-dashboard-feed-loading.md).

## Related documentation

- [`kraken-dashboard-feed-loading.md`](kraken-dashboard-feed-loading.md) — staged pool load, incremental first screen (50 rows), Next/Prev, auto-advance, env vars.
- [`daemon-integration.md`](daemon-integration.md) — broader daemon and engine API mapping; the feed table row in that doc should be read together with this file for UI-vs-JSON naming (`subnet_*` in API vs “Intent” / “Miner” labels in the modal).
