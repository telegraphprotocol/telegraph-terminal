# Kraken dashboard — feed loading (single cache model)

How the intelligence feed loads, paginates, and refreshes. Implementation: [`use-kraken-collector-cache.ts`](../src/lib/use-kraken-collector-cache.ts), [`page.tsx`](../src/app/page.tsx), [`kraken-dashboard-filters.ts`](../src/lib/kraken-dashboard-filters.ts).

For table columns and signal details, see [`kraken-dashboard-ui.md`](kraken-dashboard-ui.md).

## Three concepts

```text
Daemon API (category)  →  cache (≤800)  →  view (success + category)  →  page slice (50)
```

| Layer | What it is |
| ----- | ---------- |
| **Cache** | In-memory success rows (deduped by `id`, max `COLLECTOR_POOL_TARGET` = 800). Built from `/api/questions` with `category` (comma-separated OR) when the checklist is not “All”. |
| **View** | Client `passesDashboardFilters` (success + category OR) + `sort`. |
| **Page** | `pageIndex` 0, 1, 2… → slice of 50 rows. |

### Time range (sliding 5h windows)

Requests use RFC3339 **`since` + `until`** per window (not `since_hours`). Windows are built newest-first: `[now−5h, now]`, then `[now−10h, now−5h]`, until the UI span is covered or the pool has enough rows.

- **Manual (LAST 1H/6H/24H/72H):** total span = dropdown value (e.g. 24h → up to five 5h windows).
- **Auto catch-up:** total span = **`WINDOW_START_H`** (5h), single window.
- **Bootstrap:** paginate within each window; if **&lt; 50** success feed rows after a window, slide to the next older window.
- **Poll:** only the newest window (`since=now−5h`, `until=now` or shorter in auto mode).
- **Next / gap-fill:** resume at saved `windowIndex` + `offset`, then older windows when the current one is exhausted.

### Category filter (server + client OR)

- Daemon: `category=PHARMA,POLITICS` (comma-separated OR). Built by `buildApiCategoryParam()` in [`kraken-dashboard-filters.ts`](../src/lib/kraken-dashboard-filters.ts).
- When **all** checklist options are selected, the `category` param is **omitted** (fetch full set).
- **Category change** triggers `resetAndBootstrap()` (full refetch with new `category` param).
- Client still applies `matchesSelectedCategories` as a safety net.

Default selection: `POLITICS`, `GEOPOLITICS`, `PHARMA`, `LAW`.

### Success-only feed (client)

- API requests do **not** send `status` (remote daemon may ignore it anyway).
- Client keeps only `status === "success"` in `collectorRowsFromPage` and `passesDashboardFilters`. Errors never appear in the feed or alerts.

### Sources

- There is **no** `COLLECTOR_SOURCES` allowlist. Any daemon `source` (e.g. `reddit`, `clinicaltrials`, `openfda`, `courtlistener`) can appear in the feed if it is success and matches the category checklist.

### `min_interest`

Optional. When `NEXT_PUBLIC_KRAKEN_MIN_INTEREST` is unset, daemon queries **omit** `min_interest`.

## Load pipeline

One hook owns all fetching (`resetAndBootstrap`):

1. **Bootstrap** — Walk 5h windows (newest first) until **50** success feed rows or full span exhausted.
2. **Background** — Continue across windows until **800** rows or span exhausted.
3. **Poll** — Merge newest page from the latest window only (offset 0).
4. **Next gap fill** — One API page at the saved window cursor; advance to older windows when needed.

**Category or sort/time change:** `resetAndBootstrap()`.

## Pagination

- **Prev:** `pageIndex--` (no network).
- **Next:** Slice from cache, or one API page then `pageIndex++`.
- **Auto-advance:** Timer on page 0 only when auto catch-up mode is on.

## Environment variables

See [`.env.example`](../.env.example). **Restart the dev server** after changes.

| Variable | Default | Role |
| -------- | ------- | ---- |
| `KRAKEN_FEED_POLL_INTERVAL_MS` | `180000` | Poll: merge newest page into cache |
| `KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS` | `180000` | Auto-advance batch on page 0 |
| `NEXT_PUBLIC_KRAKEN_MIN_INTEREST` | *(unset)* | Optional daemon `min_interest` |

## Footer counts

```text
Showing {pageRows} of {filteredTotal} feed · {cacheSize} cached · {daemonTotal} daemon
```

| Metric | Meaning |
| ------ | ------- |
| **feed** | Rows in the current view after success + category filters (`filteredTotal`). |
| **cached** | Success rows in the in-memory pool (`cache.length`). |
| **daemon** | Largest `total` from the daemon API for the active query (category + time windows). Includes errors and all sources; usually **≥ feed**. |

**Why feed &lt; daemon:** The pool may not have paginated the full span yet (5h windows, bootstrap stop at 50 feed rows), and the feed excludes `status === "error"`.

### Verify with curl (default four categories, LAST 24H)

Daemon total (matches footer **daemon** when `category=GEOPOLITICS,LAW,PHARMA,POLITICS` is sent):

```bash
curl -s "http://127.0.0.1:8081/api/questions?category=GEOPOLITICS,LAW,PHARMA,POLITICS&since_hours=24&limit=1&offset=0" \
  | python3 -c "import json,sys; print('daemon:', json.load(sys.stdin).get('total', 0))"
```

Full success count for the same query (paginate all pages; often **&gt; feed** until cache finishes loading):

```bash
DAEMON=$(curl -s "http://127.0.0.1:8081/api/questions?category=GEOPOLITICS,LAW,PHARMA,POLITICS&since_hours=24&limit=1&offset=0" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
FEED=0
for ((o=0; o<DAEMON; o+=100)); do
  n=$(curl -s "http://127.0.0.1:8081/api/questions?category=GEOPOLITICS,LAW,PHARMA,POLITICS&since_hours=24&limit=100&offset=$o" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(sum(1 for r in d['results'] if r.get('status')=='success'))")
  FEED=$((FEED + n))
done
echo "feed (success): $FEED"
echo "daemon (all):   $DAEMON"
```

When **all** checklist categories are selected in the UI, the app **omits** `category` on the URL and filters the default buckets on the client; use the same curl without `category=` and filter in Python if you need to match that mode.

## Constants (code)

| Name | Value |
| ---- | ----- |
| `CATCHUP_LIMIT` | 50 rows per page |
| `COLLECTOR_POOL_TARGET` | 800 max cache size |
| `COLLECTOR_FETCH_MAX_PAGES` | 120 max API pages per progressive fetch |
| `FETCH_WINDOW_H` | 5 hours per sliding API window |
| `WINDOW_START_H` | 5 hours total span in auto mode |
| `MAX_PAGES_PER_WINDOW` | 30 offset pages max per window before sliding |
