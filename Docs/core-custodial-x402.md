# Core (NestJS) + custodial x402 + GlobalWallet

This document is the **canonical architecture** for moving **x402 payment and paid chat** off the browser and into **`telegraph-core`**, a NestJS service that holds a **single custodial EVM key** (“Global wallet”). The Next app **`telegraph-terminal`** has **no wagmi**, **no WalletConnect**, and **no user signing**; it shows **GlobalWallet** (address + balances) and sends chat turns to Core via a **server-side Next proxy** so secrets stay off the client.

For historical context on the old **browser** x402 path, see [x402-integration.md](./x402-integration.md) (that flow has been removed from the codebase).

## Goals

- **One custodial wallet** on the server (Core) pays x402 for the engine **`POST /v1/ask`** HTTP resource (auto-routing), or **`POST /v1/ask/:subnet_id`** when the Terminal uses a **selected subnet** (direct miner call).
- **Auto-routing:** latest user message is sent as **`{ query }`** to **`POST /v1/ask`**. **Direct subnet:** body includes **`subnetId`** + **`direct`** (`method`, `endpoint`, `payload`) for **`POST /v1/ask/:subnet_id`** (see engine README).
- **Intelligence Terminal**: user sends → **one** browser call to Next **`POST /api/core/chat/paid`** → Core runs paid `fetch` against the engine → UI receives **`assistantText` + `terminalReceipt` + `terminalLogs`**.
- **GlobalWallet** UI on **Kraken dashboard** and **Intelligence Terminal** top nav, fed by **`GET /api/core/wallet`** (proxied to Core **`GET /v1/wallet`**).
- **Engine WebSocket** is still used when **`NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402`** is **false** (legacy engine-only live chat).

## Architecture

```mermaid
sequenceDiagram
  participant Browser as Next_browser
  participant Next as Next_API_routes
  participant Core as telegraph_core
  participant Engine as Engine_v1_ask

  Browser->>Next: GET /api/core/wallet
  Next->>Core: GET /v1/wallet + X-Core-Api-Key
  Core-->>Next: address balances chainId
  Next-->>Browser: JSON

  Browser->>Next: POST /api/core/chat/paid + body
  Next->>Core: POST /v1/chat/paid + X-Core-Api-Key
  Core->>Engine: POST /v1/ask OR /v1/ask/:id (x402 paid)
  Engine-->>Core: 200 ask JSON + PAYMENT-RESPONSE
  Core-->>Next: ok assistantText terminalReceipt terminalLogs
  Next-->>Browser: JSON
```

## telegraph-core (NestJS)

**Location:** [`telegraph-core/`](../telegraph-core/) (sibling to `telegraph-terminal/`).

**Stack:** Nest 10, `@nestjs/config` + **zod** validation, `@nestjs/throttler`, **`@x402/fetch` + `@x402/evm` + viem** for the same paid-fetch pattern as the former browser code.

### HTTP API (global prefix `/v1`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/v1/health` | none | Liveness |
| `GET` | `/v1/wallet` | `X-Core-Api-Key` or `Authorization: Bearer` | Global wallet **address**, **chainId**, **native** balance, optional **USDC** if `CORE_USDC_ADDRESS` set |
| `POST` | `/v1/chat/paid` | same | Body **`{ messages, model?, subnetId?, direct? }`**. Without **`subnetId`**: latest **user** message → engine **`{ query }`** on **`POST /v1/ask`**. With **`subnetId`**: **`direct`** → engine **`POST /v1/ask/:subnetId`**. Returns **`{ ok, assistantText?, terminalReceipt?, terminalLogs?, error? }`** |

### Core environment variables

See [`telegraph-core/.env.example`](../telegraph-core/.env.example). Critical entries:

| Variable | Role |
|----------|------|
| `CORE_EVM_PRIVATE_KEY` | `0x` + 64 hex — **secret**; never log or expose |
| `CORE_API_KEYS` | Comma-separated keys for `X-Core-Api-Key` / Bearer |
| `CORE_EVM_RPC_URL` | HTTP RPC for signing + balance reads |
| `ENGINE_BASE_URL` | Engine HTTP base (e.g. `http://127.0.0.1:7044`); align with terminal `ENGINE_INTERNAL_URL` |
| `ENGINE_ASK_PATH` | Default `/v1/ask` |
| `TELEGRAPH_BASE_URL` | Deprecated fallback if `ENGINE_BASE_URL` unset |
| `X402_PREFERRED_EVM_CHAIN_ID` | Must match an `accepts` rail (e.g. `84532`) |
| `X402_CHAT_MODEL` | Default model label in paid chat body; direct OpenAI `/chat` also uses UI **Model** field / `NEXT_PUBLIC_X402_CHAT_MODEL` |
| `CORE_USDC_ADDRESS` | Optional USDC contract for balance display |
| `MIN_PRICE_USDC` | Receipt **cost hint** when engine omits `cost_usd` |

### Security checklist

- **Never** ship `CORE_EVM_PRIVATE_KEY` to the browser or commit it.
- **Protect** `POST /v1/chat/paid` and **`GET /v1/wallet`** with **`CORE_API_KEYS`** (empty list = guard rejects all).
- **Next.js** holds **`TERMINAL_BACKEND_API_KEY`** and **`TERMINAL_BACKEND_INTERNAL_URL`** only on the **server**; the browser calls **`/api/core/*`** without a public API key.
- Prefer **HTTPS** and **log redaction** for chat transcripts (Core receives full threads; auto-routing forwards the latest user text as **`query`**, direct mode forwards **`direct.payload`**).
- Production: HSM/Vault for keys, rate limits, monitoring of float and failed 402s.

### Run locally

```bash
cd telegraph-core
cp .env.example .env
# set CORE_EVM_PRIVATE_KEY, ENGINE_BASE_URL, CORE_EVM_RPC_URL, CORE_API_KEYS
npm install
npm run start:dev
# listens on PORT (default 3030), routes under /v1
```

Smoke:

```bash
curl -sS -H "X-Core-Api-Key: dev-local-key" http://127.0.0.1:3030/v1/wallet | jq .
```

## telegraph-terminal (Next.js)

### Feature flag

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402` | When **`true`**, [`use-live-executor.ts`](../src/lib/hooks/use-live-executor.ts) uses **Core paid chat** and **Core wallet readiness** instead of engine WS for sends. |
| `TERMINAL_BACKEND_INTERNAL_URL` | Server-only: Core base URL (default `http://127.0.0.1:3030`) |
| `TERMINAL_BACKEND_API_KEY` | Server-only: must match one of `CORE_API_KEYS` on Core |
| `ENGINE_INTERNAL_URL` | Server-only: engine base for `/api/engine/*` (subnet list, future direct ask) |

See [`.env.example`](../.env.example).

### Paid chat behaviour

- **Subnet picker:** When custodial x402 is enabled, you can choose **Auto routing** or a **specific subnet** from the engine catalog (intersected with synced YAML under `public/engine-subnets/`). Direct paid calls use **`POST /v1/ask/:subnet_id`** with **`method`**, **`endpoint`**, and **`payload`** (see engine README). The engine defaults **`method`** to **POST** when it is omitted or empty.
- **Subnet YAML:** The Intelligence Terminal loads **`public/engine-subnets/*.yaml`** and **`index.json`** only (static files in this repo). Commit and edit them here when subnets or direct-UI hints change; there is no copy step and no dependency on another tree at runtime or build time.
- **Validation:** Before opening the x402 payment flow, the client builds the direct payload and runs **`validateDirectPayload`** (required keys from each endpoint’s **`telegraph_direct.required_payload_keys`** in the **same subnet YAML the engine loads**). Missing fields surface as inline errors; the paid request is not sent until validation passes.
- **Solana:** Terminal Backend paid chat does not support Solana in this build.

### Next proxy routes

- [`src/app/api/core/wallet/route.ts`](../src/app/api/core/wallet/route.ts) → Core `GET /v1/wallet`
- [`src/app/api/core/chat/paid/route.ts`](../src/app/api/core/chat/paid/route.ts) → Core `POST /v1/chat/paid`

### UI

- [`GlobalWallet`](../src/components/global-wallet.tsx) — polls **`/api/core/wallet`**; shown when `NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402=true` in [`top-nav.tsx`](../src/components/top-nav.tsx) and [`src/app/page.tsx`](../src/app/page.tsx).
- **Sidebar** footer uses optional **`walletFooter`** from the live executor when Core mode is on.
- **Subnet routing:** [`EngineSubnetPicker`](../src/components/engine-subnet-picker.tsx) stays full-width on small viewports (`min-w-0`, touch-friendly height). With a subnet selected in paid mode, [`DirectSubnetFields`](../src/components/direct-subnet-fields.tsx) stacks endpoint and extra inputs in one column (`min-w-0`) and uses a **collapsible** “Direct request” block on narrow screens (expanded by default on `md+`).
- **Terminal receipt** panel shows engine-routed `subnet_name`, `cost_usd`, `reasoning`, `intent`, and x402 settlement when headers expose it.

### FAQ: does x402 include the chat message?

**Auto routing:** **Yes.** The paid resource is the engine **`POST /v1/ask`** with JSON **`{ query }`** (latest user text). Core mirrors the **single** paid HTTP request server-side; settlement metadata comes from x402 response headers.

**Direct subnet:** The paid resource is **`POST /v1/ask/:subnet_id`** with **`{ method, endpoint, payload }`**. The user’s main textarea is mapped into `payload` (and optional fields such as **model**, **image URL**, **lat/lon**) according to the selected endpoint; validation runs **before** payment so incomplete payloads do not trigger x402.

## Related documents

- [daemon-integration.md](./daemon-integration.md) — Engine HTTP + WS (used when Core paid chat is off).
- [x402-integration.md](./x402-integration.md) — **Deprecated** browser wagmi path (removed from code; kept for history).
