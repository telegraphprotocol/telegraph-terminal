# Core (NestJS) + custodial x402 + GlobalWallet

This document is the **canonical architecture** for moving **x402 payment and paid subnet chat** off the browser and into **`telegraph-core`**, a NestJS service that holds a **single custodial EVM key** (“Global wallet”). The Next app **`telegraph-terminal`** has **no wagmi**, **no WalletConnect**, and **no user signing**; it shows **GlobalWallet** (address + balances) and sends chat turns to Core via a **server-side Next proxy** so secrets stay off the client.

For historical context on the old **browser** x402 path, see [x402-integration.md](./x402-integration.md) (that flow has been removed from the codebase).

## Goals

- **One custodial wallet** on the server (Core) pays x402 for the **subnet-dispatcher chat** HTTP resource.
- **Same product behavior as the old browser x402 mode**: one POST carries **`{ model, messages }`**; payment is for **that** request; the **200 body** contains the **assistant completion** (plus settlement headers).
- **Intelligence Terminal**: user sends → **one** browser call to Next **`POST /api/core/chat/paid`** → Core runs paid `fetch` against Telegraph → UI receives **`assistantText` + `terminalReceipt` + `terminalLogs`**.
- **GlobalWallet** UI on **Kraken dashboard** and **Intelligence Terminal** top nav, fed by **`GET /api/core/wallet`** (proxied to Core **`GET /v1/wallet`**).
- **Engine WebSocket** is still used when **`NEXT_PUBLIC_USE_CORE_X402`** is **false** (legacy engine-only live chat).

## Architecture

```mermaid
sequenceDiagram
  participant Browser as Next_browser
  participant Next as Next_API_routes
  participant Core as telegraph_core
  participant Telegraph as Telegraph_subnet_chat

  Browser->>Next: GET /api/core/wallet
  Next->>Core: GET /v1/wallet + X-Core-Api-Key
  Core-->>Next: address balances chainId
  Next-->>Browser: JSON

  Browser->>Next: POST /api/core/chat/paid + body
  Next->>Core: POST /v1/chat/paid + X-Core-Api-Key
  Core->>Telegraph: POST x402 paid same body
  Telegraph-->>Core: 200 + chat JSON + PAYMENT-RESPONSE
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
| `POST` | `/v1/chat/paid` | same | Body **`{ model, messages }`**. Runs **full** x402 + subnet chat; returns **`{ ok, assistantText?, terminalReceipt?, terminalLogs?, error? }`** |

### Core environment variables

See [`telegraph-core/.env.example`](../telegraph-core/.env.example). Critical entries:

| Variable | Role |
|----------|------|
| `CORE_EVM_PRIVATE_KEY` | `0x` + 64 hex — **secret**; never log or expose |
| `CORE_API_KEYS` | Comma-separated keys for `X-Core-Api-Key` / Bearer |
| `CORE_EVM_RPC_URL` | HTTP RPC for signing + balance reads |
| `TELEGRAPH_BASE_URL` | Telegraph node base (no trailing slash required) |
| `SUBNET_GROQ_CHAT_PATH` | Default `/subnet-dispatcher/v1/102/chat` |
| `X402_PREFERRED_EVM_CHAIN_ID` | Must match an `accepts` rail (e.g. `84532`) |
| `X402_CHAT_MODEL` | Default model string forwarded to Telegraph |
| `CORE_USDC_ADDRESS` | Optional USDC contract for balance display |
| `MIN_PRICE_USDC` | Receipt **cost hint** when upstream does not expose a single parsed amount |

### Security checklist

- **Never** ship `CORE_EVM_PRIVATE_KEY` to the browser or commit it.
- **Protect** `POST /v1/chat/paid` and **`GET /v1/wallet`** with **`CORE_API_KEYS`** (empty list = guard rejects all).
- **Next.js** holds **`CORE_API_KEY`** and **`CORE_INTERNAL_URL`** only on the **server**; the browser calls **`/api/core/*`** without a public API key.
- Prefer **HTTPS** and **log redaction** for chat transcripts (Core receives full threads).
- Production: HSM/Vault for keys, rate limits, monitoring of float and failed 402s.

### Run locally

```bash
cd telegraph-core
cp .env.example .env
# set CORE_EVM_PRIVATE_KEY, TELEGRAPH_BASE_URL, CORE_EVM_RPC_URL, CORE_API_KEYS
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
| `NEXT_PUBLIC_USE_CORE_X402` | When **`true`**, [`use-live-executor.ts`](../src/lib/hooks/use-live-executor.ts) uses **Core paid chat** and **Core wallet readiness** instead of engine WS for sends. |
| `CORE_INTERNAL_URL` | Server-only: Core base URL (default `http://127.0.0.1:3030`) |
| `CORE_API_KEY` | Server-only: must match one of `CORE_API_KEYS` on Core |

See [`.env.example`](../.env.example).

### Next proxy routes

- [`src/app/api/core/wallet/route.ts`](../src/app/api/core/wallet/route.ts) → Core `GET /v1/wallet`
- [`src/app/api/core/chat/paid/route.ts`](../src/app/api/core/chat/paid/route.ts) → Core `POST /v1/chat/paid`

### UI

- [`GlobalWallet`](../src/components/global-wallet.tsx) — polls **`/api/core/wallet`**; shown when `NEXT_PUBLIC_USE_CORE_X402=true` in [`top-nav.tsx`](../src/components/top-nav.tsx) and [`src/app/page.tsx`](../src/app/page.tsx).
- **Sidebar** footer uses optional **`walletFooter`** from the live executor when Core mode is on.

### FAQ: does x402 include the chat message?

**Yes.** The paid resource is the **subnet chat POST** with JSON **`{ model, messages }`**. There is no separate “pay then chat” hop on the client; Core mirrors that **single** paid HTTP request server-side.

## Related documents

- [daemon-integration.md](./daemon-integration.md) — Engine HTTP + WS (used when Core paid chat is off).
- [x402-integration.md](./x402-integration.md) — **Deprecated** browser wagmi path (removed from code; kept for history).
