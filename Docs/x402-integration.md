# Browser x402 Paid Chat (Intelligence Terminal)

This document describes how **HTTP + x402** is wired into `telegraph-terminal` for the **Intelligence Terminal** live chat: paid requests go **directly** to Telegraph’s **subnet-dispatcher** chat route (subnet **102**), instead of the engine **WebSocket** `ask` flow.

## Goals

- Let a connected **EVM wallet** complete the standard **402 Payment Required → sign → retry with payment** flow in the browser.
- Reuse Telegraph’s existing dispatcher URL and subnet path from environment variables.
- Surface **payment phase** in the UI (banner + loading hint) and **settlement** in the terminal receipt (tx link when headers expose it).

## Feature flag and environment

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_USE_X402_CHAT` | When `"true"`, `useLiveExecutor` sends each user message via **x402 HTTP** instead of engine WS. Default in `.env.example` is `false`. |
| `NEXT_PUBLIC_TELEGRAPH_BASE_URL` | Base URL for the Telegraph node (falls back to `NEXT_PUBLIC_RESOURCE_SERVER_URL` if unset). Trailing slashes are stripped when building URLs. |
| `NEXT_PUBLIC_SUBNET_GROQ_CHAT_PATH` | Path appended to the base for chat POSTs (default `/subnet-dispatcher/v1/102/chat`). |
| `NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID` | Chain id the app **switches to** before signing (default **84532** Base Sepolia). Must appear in the dispatcher’s x402 **`accepts`** list for the chosen rail. When **`NEXT_PUBLIC_CHAIN_ID`** is unset, wagmi’s **default** chain also follows this value for **84532**, **8453**, or **137** (see `wagmi-config.ts`). |
| `NEXT_PUBLIC_CHAIN_ID` | Optional explicit wagmi primary chain: **`84532`** (Base Sepolia), **`8453`** (Base), or **`137`** (Polygon). Overrides the x402-derived default. |
| `NEXT_PUBLIC_USE_BASE_SEPOLIA` | When **`true`**, wagmi primary chain is **Base Sepolia** (same as `NEXT_PUBLIC_CHAIN_ID=84532`). |
| `NEXT_PUBLIC_X402_CHAT_MODEL` | OpenAI-style `model` field in the JSON body (default `gpt-4o-mini`). |
| `NEXT_PUBLIC_MIN_PRICE_USDC` | Used for **receipt display** cost hint when exact pricing is not parsed from headers. |
| `NEXT_PUBLIC_DEFAULT_NETWORK` | If set to **`solana`**, x402 chat is **blocked** in this build (EVM-only path). |
| `NEXT_PUBLIC_X402_CHAT_USE_PROXY` | Optional override for same-origin **`/api/x402-chat`** relay: **`true`** always use proxy, **`false`** never (direct POST to `NEXT_PUBLIC_TELEGRAPH_BASE_URL` even when cross-origin). When unset, proxy is used **automatically** when the dispatcher origin differs from the app origin (so **`PAYMENT-REQUIRED`** is visible to `@x402/fetch`). |

Polygon / Base explorer URLs and Solana explorer env vars are documented in `.env.example`; settlement header parsing can surface EVM txs so those URLs matter for receipt links.

## NPM packages

- **`@x402/fetch`** — `x402Client`, `wrapFetchWithPayment`, payment requirement decoding from responses.
- **`@x402/evm`** — `ExactEvmScheme`, `toClientEvmSigner` bridging a viem `WalletClient` into the x402 client.
- **`@x402/core`** (types) — `PaymentRequirements`, `SettleResponse`, etc.

`package.json` pins compatible `^2.11.x` lines for fetch/evm/svm (SVM is a dependency for the stack; **browser chat uses EVM only** here).

## Wagmi / viem configuration

File: `src/lib/wagmi-config.ts`.

- **`targetBaseChain`** (wagmi default) is resolved in order: **`NEXT_PUBLIC_CHAIN_ID`** (84532 / 8453 / 137), then **`NEXT_PUBLIC_USE_BASE_SEPOLIA`**, then **`NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID`** for the same ids, else **Base mainnet**. That way a typical `.env` with only **`NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID=84532`** uses **Base Sepolia** as the primary chain instead of Base mainnet, reducing wallet / x402 chain skew.
- **`wagmiChainById(chainId)`** returns a registered `Chain` for building `wallet_addEthereumChain` metadata.
- **Additional chains** are registered so `switchChain` can reach networks Telegraph advertises in x402 **`accepts`** (e.g. **Base Sepolia 84532**, **Polygon 137**, **Base 8453**), deduplicated against the primary chain.

Without these extra chains, the wallet cannot switch to the rail the server requires.

## HTTP client wrapper (`src/lib/x402-telegraph-fetch.ts`)

Responsibilities:

1. **`getTelegraphChatUpstreamUrl()`** — direct dispatcher URL (server proxy target).
2. **`getTelegraphChatUrl()`** — URL used by the browser: same as upstream when same-origin; otherwise **`/api/x402-chat`** (see below) unless `NEXT_PUBLIC_X402_CHAT_USE_PROXY=false`.
3. **`buildEvmX402PaidFetch(walletClient, publicClient, walletChainId)`** — builds a **`fetch`** compatible function that:
   - Wraps global `fetch` with **`wrapFetchWithPayment`**.
   - Uses **`ExactEvmScheme`** with **`toClientEvmSigner`**, mapping `signTypedData` to the viem wallet client.
   - Uses **`createChainMatchingSelector(walletChainId)`** so the client picks a **`PaymentRequirements`** entry whose `network` matches **`eip155:<walletChainId>`** when possible, otherwise the first option.
4. **`settlementFromResponse(response)`** — reads **`PAYMENT-RESPONSE`** / case variants and decodes via **`decodePaymentResponseHeader`** for receipt / logs.
5. **`explorerUrlForSettlement(settle, paymentChainId?)`** — maps `settle.network` + `transaction` to an explorer when the network is known (`eip155:*`, Solana). If `settle.network` is missing or not parseable, uses **`paymentChainId`** (the x402 signing chain from the live executor) so Base Sepolia and other rails are not mislabeled as Polygon. Unsupported EVM chain IDs return no URL instead of defaulting to PolygonScan.

### CORS and the `/api/x402-chat` proxy

`@x402/fetch` reads **`PAYMENT-REQUIRED`** from the **402** response (or a legacy v1 JSON body). On **cross-origin** `fetch`, browsers only expose response headers listed in **`Access-Control-Expose-Headers`**. If the dispatcher does not expose **`PAYMENT-REQUIRED`** (and payment response headers on success), `getPaymentRequiredResponse` throws **“Invalid payment required response”** — the same symptom as a malformed body.

The Next.js route **`src/app/api/x402-chat/route.ts`** forwards POSTs to **`getTelegraphChatUpstreamUrl()`** and returns the upstream status, body, and headers to the **same-origin** app. JavaScript can then read x402 headers without CORS stripping.

## Live executor hook (`src/lib/hooks/use-live-executor.ts`)

### Mode selection

- **`USE_X402_CHAT`** — compile-time flag from `NEXT_PUBLIC_USE_X402_CHAT === "true"`.
- **`isConnected`** — **wallet path**: `connection.status === "connected"` + `chainId` + `walletClient?.account`. **Engine path**: engine WebSocket connected. The UI treats “connected” differently per mode.

### Send path (`handleSend`)

1. **Early validation** (before optimistic message append): empty text, **`!isConnected`**, and Solana default network guard for x402 mode — avoids appending a user bubble that would immediately fail without a wallet.
2. **Thread for API** — prior messages for the active session (excluding user messages in **`sendState: "failed"`**) plus the new user message; converted to OpenAI-style `{ role, content }[]` via **`chatMessagesToOpenAi`**.
3. **Optimistic UI** — append user message with **`sendState: "pending"`**, clear logs/receipt, set loading, clear runtime/x402 phase errors.
4. **If `USE_X402_CHAT`** — **`executeX402Request(sessionId, userMessageId, openAiMessages)`**:
   - **`pushLog`** — structured “Payment & Rail” terminal lines (network switch, x402, settled).
   - **Chain gate** — uses **`getChainId(wagmiConfig)`** as the canonical signal (same as signing). If it ≠ **`X402_PREFERRED_EVM_CHAIN_ID`**, call **`ensureOnTargetChain`** then **`waitForWalletChain`**, with bounded retries. Connector chain is logged only (can lag the provider). Final check uses wagmi chain id, not **`connector.getChainId()`** alone.
   - **`getWalletClient(wagmiConfig, { chainId: preferred })`** + **`getPublicClient(wagmiConfig, { chainId: preferred })`** → **`buildEvmX402PaidFetch`**.
   - **`paidFetch(chatUrl, { method: "POST", headers, body: { model, messages } })`**.
   - On success: mark the user message **`sendState: "ok"`**, append assistant message, fill **`terminalReceipt`**, set **`x402Phase`** to `settled`, clear **`runtimeError`**.
   - On failure: mark the user message **`sendState: "failed"`** and **`sendError`** (message stays in the thread); set **`runtimeError`**; clear paying phase; **`finally`** clears loading.
5. **`handleRetrySend(messageId)`** — for a **failed** user message, sets **`pending`** again and re-runs **`executeX402Request`** with a rebuilt OpenAI thread (failed turns omitted from history).
6. **Else (engine)** — set `activeQueryCell`, **`sendMessage`** with `action: "ask"` as before; user messages use **`sendState`** the same way; engine WS **`error`** marks the last user message failed instead of deleting it.

Engine WS error handling remains for non-x402 mode; **`engineError`** exposed to the page is **`runtimeError`** in x402 mode (WS **`lastError`** is not mixed into the banner).

### Sessions and sidebar

Each chat is a persisted **`ChatSession`** (including empty “New chat” rows). **`chatHistoryGroups`** lists non-archived and archived sessions. LocalStorage stores **`sessions`** and **`activeSessionId`**.

## UI (`src/app/intelligence-terminal/page.tsx` and related)

- **Banner** — If x402 mode: shows when wallet not ready or **`engineError`**; copy prompts Base Sepolia / Polygon. If engine mode: WS connection message.
- **`loadingHint`** on **`ChatArea`** — While **`x402Phase === "paying"`**, shows text asking the user to **sign in the wallet** if prompted.
- **Failed user messages** — Red bubble, inline **`sendError`**, and a **Retry** control calling **`handleRetrySend`**.
- **`TerminalPanel` / receipt** — If the receipt includes **`x402ExplorerUrl`**, show a **Payment (x402)** link and truncated hash.

## Operational checklist

1. Set **`NEXT_PUBLIC_USE_X402_CHAT=true`** and point **`NEXT_PUBLIC_TELEGRAPH_BASE_URL`** (or **`NEXT_PUBLIC_RESOURCE_SERVER_URL`**) at a node whose **102** chat route speaks x402 over HTTPS (or HTTP for local dev, subject to mixed-content rules in production).
2. Ensure **`NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID`** matches an **`accepts`** entry the facilitator / resource server returns on **402**.
3. For **direct** browser → dispatcher calls (`NEXT_PUBLIC_X402_CHAT_USE_PROXY=false` or same-origin URL), confirm **CORS** on the Telegraph host allows your origin and lists **`PAYMENT-REQUIRED`** / payment response headers in **`Access-Control-Expose-Headers`**. With the default **cross-origin proxy**, the Next server calls the dispatcher (no browser CORS on that hop).
4. Connect an injected EVM wallet; if the preferred chain is missing, approve **Add network** when the wallet prompts.

## Limitations (current build)

- **Solana x402** for this chat path is **not** implemented; **`NEXT_PUBLIC_DEFAULT_NETWORK=solana`** blocks send with a clear **`runtimeError`**.
- Pricing in the receipt is partly **config-driven** (`NEXT_PUBLIC_MIN_PRICE_USDC`) when the protocol does not expose a single parsed amount in UI.
- Subnet forcing / **`forcedSubnetId`** applies to the **engine** branch; x402 chat always targets the **configured HTTP path** (subnet 102 by default).

## Related files (quick index)

| Area | Path |
|------|------|
| x402 fetch + URL helpers | `src/lib/x402-telegraph-fetch.ts` |
| Send + session state | `src/lib/hooks/use-live-executor.ts` |
| Wagmi chains | `src/lib/wagmi-config.ts` |
| Chain switch + add network | `src/components/wallet/ensure-base-chain.ts` |
| Terminal page wiring | `src/app/intelligence-terminal/page.tsx` |
| Receipt UI | `src/components/terminal-panel.tsx` |
| Example env | `.env.example` |
| Same-origin x402 proxy | `src/app/api/x402-chat/route.ts` |
