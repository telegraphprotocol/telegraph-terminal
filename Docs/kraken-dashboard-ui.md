# Kraken dashboard UI (Telegraph terminal)

This document describes the Kraken intelligence dashboard UI in the Next.js app (`/` → [`src/app/page.tsx`](../src/app/page.tsx)), the feed and supporting components, and related utilities. It reflects the implementation as of the work session that added intent labeling, CSV export, signal details, and feed interaction refinements.

## Data flow

1. **Daemon read API** — The browser calls same-origin **`/api/daemon/*`** (see [`api-client.ts`](../src/lib/api-client.ts)); Next proxies to the daemon using **`DAEMON_INTERNAL_URL`** (default `http://127.0.0.1:8081`). The dashboard loads `/api/questions` (proxied as `/api/daemon/api/questions`) with filters (`since_hours`, `category`, `sort`, `order`, `limit`, `offset`, `min_interest`) and `/api/questions/top` for the right-hand alerts column. Health is checked via `/health` (proxied as `/api/daemon/health`).
2. **Collector-only feed** — The main table applies a client-side filter: rows where `source` is one of `reddit`, `gdelt`, `polymarket`, `hackernews`, `openmeteo`, excluding `user`. Totals still reflect the daemon page `total`; the table may show fewer rows than `total` when non-collector rows exist on the same page.
3. **Engine catalog** — [`GET /v1/subnets`](../src/lib/api-client.ts) via **`/api/engine/v1/subnets`**; Next proxies to the engine using **`ENGINE_INTERNAL_URL`** (default `http://127.0.0.1:7044`). This feeds the header subnet picker and [`KrakenSkillCards`](../src/components/kraken/kraken-skill-cards.tsx). This is independent of the daemon feed.

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

- **Scope:** Exports the **current in-memory `signals` array** (the filtered collector rows for the active page), not the full daemon result set across all pages.
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
| [`src/lib/engine-daemon-types.ts`](../src/lib/engine-daemon-types.ts)                             | `DaemonResultItem` and related types aligned with daemon `SubnetResult` JSON. |
| [`src/components/kraken/kraken-alerts.tsx`](../src/components/kraken/kraken-alerts.tsx)           | Live alpha alerts from top signals.                                           |
| [`src/components/kraken/kraken-analytics.tsx`](../src/components/kraken/kraken-analytics.tsx)     | Charts from current feed slice.                                               |
| [`src/components/kraken/kraken-skill-cards.tsx`](../src/components/kraken/kraken-skill-cards.tsx) | Engine subnet cards from `/v1/subnets`.                                       |

## Environment

See [`.env`](../.env) (or [`.env.example`](../.env.example)) for:

- **`DAEMON_INTERNAL_URL`** — Next server → daemon HTTP (browser uses `/api/daemon/*`).
- **`ENGINE_INTERNAL_URL`** — Next server → engine HTTP (browser uses `/api/engine/*`).
- **`NEXT_PUBLIC_ENGINE_WS_URL`** — Browser → engine WebSocket (still direct; not proxied by Next).

## Related documentation

- [`daemon-integration.md`](daemon-integration.md) — broader daemon and engine API mapping; the feed table row in that doc should be read together with this file for UI-vs-JSON naming (`subnet_*` in API vs “Intent” / “Miner” labels in the modal).
