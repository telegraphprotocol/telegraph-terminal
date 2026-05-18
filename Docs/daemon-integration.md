# Daemon + Engine Frontend Integration

This document is the canonical implementation guide for integrating the frontend in this repo with:

- Engine HTTP + WebSocket APIs
- Daemon read APIs backed by MongoDB

It includes agreed product decisions, exact response contracts, UI mapping, and implementation order.

## Final Decisions (Locked)

- Failure UX uses **separate banners**:
  - Engine banner for chat/runtime/WS issues
  - Daemon banner for dashboard/read API issues
- No additional Auth/CORS/deploy work required right now
- Category mapping uses daemon enum values **as-is**
- Persistence expectation is **daemon only**
- Realtime strategy for live ask is **WebSocket**
- Dashboard feed shows success rows for selected categories (all daemon sources).

## Startup / Local Test Order

1. Ensure `.env` is loaded and MongoDB is running in Docker
2. Start daemon first
3. Start engine second
4. Test engine ask endpoint

Commands:

```bash
export $(grep -v '^#' .env | sed 's/#.*//' | xargs) && go run ./pkg/engine/daemon -engine-server http://localhost:8080
```

```bash
export $(grep -v '^#' .env | sed 's/#.*//' | xargs) && go run ./pkg/engine
```

```bash
curl -X POST http://localhost:7044/v1/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "hey, can you tell me what is 1+1"}'
```

## Base URLs

Current frontend setup (see `.env.example`):

- **Engine/daemon HTTP** — The browser uses same-origin **`/api/engine/*`** and **`/api/daemon/*`**. Next proxies to upstream using **`ENGINE_INTERNAL_URL`** (default `http://127.0.0.1:7044`) and **`DAEMON_INTERNAL_URL`** (default `http://127.0.0.1:8081`). This matches the pattern used for Core (`CORE_INTERNAL_URL` + `/api/core/*`).
- **Engine WebSocket** — Still direct from the browser: **`NEXT_PUBLIC_ENGINE_WS_URL`** (e.g. `ws://localhost:7044/ws`). For remote-only UIs, tunnel engine WS or put a reverse proxy in front; Next does not proxy WebSocket in this repo.

## Architecture Summary

- Engine (`/v1/*`, `/ws`) handles routing + subnet execution.
- Daemon runs collectors, enriches via engine ask calls, and writes/reads signal pipeline results in MongoDB.
- Daemon read API (`/api/questions*`, `/api/categories`, `/health`) is the dashboard data backend.

## Response Contracts

Everything below is aligned to backend structs and current behavior.

### 1) Engine WebSocket (`ws://localhost:<PORT>/ws`)

Every server frame uses this envelope:

```json
{ "type": "<event>", "data": { "...": "..." }, "timestamp": "2026-05-07T19:24:42Z" }
```

Notes:

- `data` may be omitted when nil (e.g. `pong`)
- `timestamp` is RFC3339 UTC

Client ask request:

```json
{ "action": "ask", "query": "What is the current weather in London?" }
```

Server event flow:

1. `connected`
2. `received`
3. `routing`
4. `routed`
5. `executing`
6. terminal frame: `result` or `error`

Success terminal frame shape:

```json
{
  "type": "result",
  "data": {
    "subnet_used": "18",
    "subnet_name": "zeus",
    "result": { "...subnet-specific payload..." },
    "cost": "$0.0021",
    "timestamp": "2026-05-07T19:24:42Z",
    "reasoning": "Weather forecast query - Zeus subnet handles meteorological predictions."
  },
  "timestamp": "2026-05-07T19:24:42Z"
}
```

Error terminal frame shape:

```json
{
  "type": "error",
  "data": { "message": "execution failed: subnet 18 returned 503: upstream timeout" },
  "timestamp": "2026-05-07T19:24:42Z"
}
```

Other WS actions:

- `ask_direct`: requires `subnet_id`, `endpoint`, `payload`; terminal `result.data` is `{ subnet_id, subnet_name, result, cost, timestamp }` (no `reasoning`)
- `list_subnets`: terminal `result.data` is `{ subnets, count }`
- `ping`: server replies with `pong` frame

Connection behavior:

- backend sends low-level WS ping every ~30s
- read deadline is ~90s
- frontend should treat 90s+ silence as stale/disconnected

### 2) Engine HTTP ask (`POST /v1/ask`)

Success shape:

```json
{
  "subnet_used": "102",
  "subnet_name": "openai",
  "result": { "...subnet payload..." },
  "cost": "$0.0000",
  "timestamp": "2026-05-07T19:24:42Z",
  "reasoning": "Arithmetic / general LLM question - routed to OpenAI chat completions."
}
```

Important:

- this is final-state only (no progressive logs)
- `result` is `any` and varies by subnet
- `cost` is a formatted **string**
- `reasoning` may be omitted

HTTP error shape:

```json
{ "error": "..." }
```

No `error_stage` is returned from `/v1/ask` HTTP errors.

### 3) Engine HTTP direct ask (`POST /v1/ask/:subnet_id`)

```json
{
  "subnet_id": "102",
  "subnet_name": "openai",
  "result": { "...subnet payload..." },
  "cost": "$0.0000",
  "timestamp": "2026-05-07T19:25:01Z"
}
```

No `reasoning` on direct ask response.

### 4) Daemon questions feed (`GET /api/questions`)

Page wrapper:

```json
{
  "results": [],
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

Full item shape (fields inlined from question scoring + subnet response):

```json
{
  "id": "67307b94c2a4f7c8e1f10a23",
  "source": "reddit",
  "status": "success",
  "created_at": "2026-05-07T18:42:11Z",
  "question": "Will the NBA Finals 2026 go to a Game 7?",
  "category": "SPORTS",
  "interest_score": 7.4,
  "affected_pct": 0.8,
  "audience_pct": 21.5,
  "subnet_response": {
    "subnet_used": "101",
    "subnet_name": "groq-compound",
    "result": { "...subnet payload..." },
    "cost": "$0.0021",
    "timestamp": "2026-05-07T18:42:09Z",
    "reasoning": "Sports / current-events lookup - routed to Groq Compound search."
  }
}
```

Error row example:

```json
{
  "status": "error",
  "subnet_response": {
    "result": null,
    "cost": "",
    "error": "subnet 22 returned 503: upstream timeout",
    "error_stage": "execution"
  }
}
```

Important:

- `results` is never `null` (empty array when no matches)
- `error_stage` is available in daemon DB reads, not in `/v1/ask` HTTP errors
- direct api/ws rows can have zeroed scoring fields and empty question/category

### 5) Daemon top/cats/health

`GET /api/questions/top`:

- same page shape as `/api/questions`
- sorted by `interest_score desc`

`GET /api/categories`:

```json
{
  "stats": [
    { "category": "TECHNOLOGY", "count": 124, "avg_interest": 6.7, "max_interest": 9.2 }
  ],
  "categories": [
    "POLITICS","ECONOMICS","GEOPOLITICS","TECHNOLOGY","CLIMATE","HEALTH",
    "FINANCE","CRYPTO","SPORTS","SCIENCE","SOCIAL","OTHER"
  ]
}
```

`GET /health`:

```json
{ "status": "ok", "time": "2026-05-07T19:25:01Z" }
```

## UI Mapping Matrix

### A) Intelligence Terminal (`/intelligence-terminal`)

| UI target | Backend source | Mapping |
|---|---|---|
| Submit ask | WS send | `{ "action":"ask", "query": text }` |
| Progress logs | WS `connected/received/routing/routed/executing/error` | one log row per frame (`label=type`, `time=timestamp`, details from `data`) |
| Assistant answer | WS `result.data.result` | render by subnet-aware parser; fallback to JSON |
| Receipt/footer | WS `result.data` | `subnet_used`, `subnet_name`, `cost`, `timestamp`, optional `reasoning` |
| Engine banner | WS disconnect/error/runtime error | separate engine status banner |

### B) Dashboard Feed (`KrakenFeed`)

See **[kraken-dashboard-ui.md](kraken-dashboard-ui.md)** (columns, category OR filter, footer counts) and **[kraken-dashboard-feed-loading.md](kraken-dashboard-feed-loading.md)** (cache, pagination, env vars).

| Feed field | Daemon / API field | Mapping (current UI) |
|---|---|---|
| Timestamp | `created_at` | local formatted time |
| Intent | `routing.intent`, else `routing.subnet_name` + `routing.subnet_id` | `formatKrakenIntentCell` in app code |
| Input snippet | `question.text` | truncated text |
| Status | `status` (+ optional `routing.error_stage`) | success/error badges |
| Cost | `execution.cost_usd` | formatted USD |
| Source | `source` | collector name; copy button copies string only |
| Proof | `execution.error` / `routing.reasoning` | tooltip on icon only |
| Details | — | chevron column opens modal with full row + JSON result |

Historical note: older docs referred to a flat `subnet_response` shape; live `/api/questions` items are nested (`question`, `routing`, `execution`) per `DaemonResultItem`.

Recommended query (daemon CLI / curl):

```text
/api/questions?category=GEOPOLITICS,LAW,PHARMA,POLITICS&since_hours=24&sort=recent&order=desc&limit=20&offset=0
```

Kraken dashboard (current app):

- Server: comma-separated `category` (OR), RFC3339 `since`/`until` per 5h window (or `since_hours` in curl examples). Omit `category` when every checklist option is selected.
- Client: `status === "success"` and selected category checklist; **no** `COLLECTOR_SOURCES` filter — all sources (e.g. `clinicaltrials`, `openfda`, `reddit`) are eligible.
- Footer **daemon** = API `total`; **feed** / **cached** = success rows loaded and filtered in the browser (see [`kraken-dashboard-feed-loading.md`](kraken-dashboard-feed-loading.md#footer-counts)).
- Optional server-side: `min_interest` only when `NEXT_PUBLIC_KRAKEN_MIN_INTEREST` is set (default: omitted).
- Default time window: LAST 24H (`useManualTimeRange: true` on first load).

**Note:** The Go daemon DB supports `status=success|error`, but the HTTP parser in `parseQueryParams` may not wire `status` until deployed; the terminal filters success on the client regardless.

### C) Alerts (`KrakenAlerts`)

Use:

```text
/api/questions/top?since_hours=1&limit=10
```

Optional knobs:

- `category=...`
- or filter by `min_interest` on `/api/questions`

Mapping:

- title <- `question`
- severity <- `status` + `interest_score` (+ `error_stage` when present)
- description <- summarized `subnet_response.result`
- attribution <- subnet id/name
- cost chip <- `subnet_response.cost`

### D) Analytics (`KrakenAnalytics`)

Derive from `/api/questions` rows:

- interest trend <- `interest_score` over `created_at`
- affected trend <- `affected_pct`
- audience trend <- `audience_pct`
- success rate <- `status`
- category distribution <- `category`
- cost trend <- parse numeric from `subnet_response.cost` (strip `$`)

## Query Parameters to Support

`GET /api/questions`:

- `category` (comma-separated OR, e.g. `PHARMA,POLITICS`; native values include `PHARMA`, `LAW`)
- `source`
- `status` (`success` | `error` — DB filter; confirm HTTP layer on your daemon build)
- `sort` (`recent`, `interest`, `affected`, `audience`)
- `order` (`asc`, `desc`)
- `since` / `until`
- `since_hours`
- `min_interest`
- `min_affected`
- `min_audience`
- `limit`
- `offset`

## TypeScript Contracts (Frontend)

```ts
type EngineWsFrame = {
  type:
    | "connected"
    | "received"
    | "routing"
    | "routed"
    | "executing"
    | "result"
    | "error"
    | "pong";
  data?: any;
  timestamp: string; // RFC3339
};

type DaemonQuestionPage = {
  results: DaemonQuestionItem[];
  total: number;
  limit: number;
  offset: number;
};

type DaemonQuestionItem = {
  id: string;
  source: string;
  status: "success" | "error";
  created_at: string;
  question: string;
  category: string;
  interest_score: number;
  affected_pct: number;
  audience_pct: number;
  subnet_response: {
    subnet_used: string;
    subnet_name: string;
    result: any | null;
    cost: string;
    timestamp: string;
    reasoning?: string;
    error?: string;
    error_stage?: "routing" | "execution" | "lookup";
  };
};
```

## Implementation Notes for This Repo

Current frontend state:

- `src/lib/api-client.ts` currently defines `smartAsk` response as `{ answer, logs, receipt }`, which does not match canonical engine contract.
- `src/lib/hooks/use-live-executor.ts` currently expects that legacy shape.
- `src/lib/hooks/use-engine-ws.ts` already provides basic WS connection/send primitives and should be the primary path for live progress logs.
- `src/components/kraken/*` are currently mock/static and should be migrated to daemon-backed data.

Recommended implementation order:

1. Update shared types (`api-client` / hooks) to canonical contracts
2. Move live chat execution flow to WS-first (`ask` action + event stream)
3. Map terminal logs from WS events
4. Add receipt rendering from terminal `result.data`
5. Replace `kraken-feed` with `/api/questions` data
6. Replace `kraken-alerts` with `/api/questions/top`
7. Drive analytics from aggregated daemon rows
8. Add separate engine vs daemon health banners

## Safe Rendering Rules

1. Treat `subnet_response.result` (and engine `result`) as opaque, subnet-specific payloads.
2. `cost` is string currency; do not assume numeric JSON.
3. Use `status === "error"` as primary error indicator for daemon rows.
4. `reasoning` is optional (`omitempty` behavior).
5. Use `total` with `limit`/`offset` for pagination; do not assume `results.length === limit`.

