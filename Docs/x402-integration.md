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
| `NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID` | Chain id the app **switches to** before signing (default **84532** Base Sepolia). Must appear in the dispatcher’s x402 **`accepts`** list for the chosen rail. |
| `NEXT_PUBLIC_X402_CHAT_MODEL` | OpenAI-style `model` field in the JSON body (default `gpt-4o-mini`). |
| `NEXT_PUBLIC_MIN_PRICE_USDC` | Used for **receipt display** cost hint when exact pricing is not parsed from headers. |
| `NEXT_PUBLIC_DEFAULT_NETWORK` | If set to **`solana`**, x402 chat is **blocked** in this build (EVM-only path). |

Polygon / Base explorer URLs and Solana explorer env vars are documented in `.env.example`; settlement header parsing can surface EVM txs so those URLs matter for receipt links.

## NPM packages

- **`@x402/fetch`** — `x402Client`, `wrapFetchWithPayment`, payment requirement decoding from responses.
- **`@x402/evm`** — `ExactEvmScheme`, `toClientEvmSigner` bridging a viem `WalletClient` into the x402 client.
- **`@x402/core`** (types) — `PaymentRequirements`, `SettleResponse`, etc.

`package.json` pins compatible `^2.11.x` lines for fetch/evm/svm (SVM is a dependency for the stack; **browser chat uses EVM only** here).

## Wagmi / viem configuration

File: `src/lib/wagmi-config.ts`.

- The app’s primary chain remains **`targetBaseChain`** (Base or Base Sepolia from env).
- **Additional chains** are registered so `switchChain` can reach networks Telegraph advertises in x402 **`accepts`** (e.g. **Base Sepolia 84532**, **Polygon 137**, **Base 8453**), deduplicated against the primary chain.

Without these extra chains, the wallet cannot switch to the rail the server requires.

## HTTP client wrapper (`src/lib/x402-telegraph-fetch.ts`)

Responsibilities:

1. **`getTelegraphChatUrl()`** — `getTelegraphBaseUrl()` + `getSubnetChatPath()` (with sane defaults).
2. **`buildEvmX402PaidFetch(walletClient, publicClient, walletChainId)`** — builds a **`fetch`** compatible function that:
   - Wraps global `fetch` with **`wrapFetchWithPayment`**.
   - Uses **`ExactEvmScheme`** with **`toClientEvmSigner`**, mapping `signTypedData` to the viem wallet client.
   - Uses **`createChainMatchingSelector(walletChainId)`** so the client picks a **`PaymentRequirements`** entry whose `network` matches **`eip155:<walletChainId>`** when possible, otherwise the first option.
3. **`settlementFromResponse(response)`** — reads **`PAYMENT-RESPONSE`** / case variants and decodes via **`decodePaymentResponseHeader`** for receipt / logs.
4. **`explorerUrlForSettlement(settle)`** — maps `settle.network` + `transaction` to Base Sepolia, Polygon, Base, or Solana explorer URLs using env overrides where present.

The module header notes **CORS**: the dispatcher must allow browser origins for this to work (verified against operator sample with permissive CORS).

## Live executor hook (`src/lib/hooks/use-live-executor.ts`)

### Mode selection

- **`USE_X402_CHAT`** — compile-time flag from `NEXT_PUBLIC_USE_X402_CHAT === "true"`.
- **`isConnected`** — **wallet path**: `connection.status === "connected"` + `chainId` + `walletClient?.account`. **Engine path**: engine WebSocket connected. The UI treats “connected” differently per mode.

### Send path (`handleSend`)

1. **Early validation** (before optimistic message append): empty text, **`!isConnected`**, and Solana default network guard for x402 mode — avoids appending a user bubble that is immediately reverted on failure.
2. **Thread for API** — prior messages for the active session plus the new user message; converted to OpenAI-style `{ role, content }[]` via **`chatMessagesToOpenAi`**.
3. **Optimistic UI** — append user message, clear logs/receipt, set loading, clear runtime/x402 phase errors.
4. **If `USE_X402_CHAT`**:
   - **`pushLog`** — structured “Payment & Rail” terminal lines (network switch, x402, settled).
   - If wallet **`chainId` ≠ `X402_PREFERRED_EVM_CHAIN_ID`**, call **`ensureOnTargetChain`** (`switchChainAsync`); on user reject or error, **revert** last optimistic user message and set **`runtimeError`** (friendly copy via **`friendlyInfraError`**).
   - **`waitForWalletChain(preferredId)`** — polls **`getChainId(wagmiConfig)`** until it matches (post-switch sync); on timeout, revert + banner.
   - **`getWalletClient(wagmiConfig)`** + **`getPublicClient(wagmiConfig, { chainId: preferred })`** → **`buildEvmX402PaidFetch`**.
   - **`paidFetch(chatUrl, { method: "POST", headers, body: { model, messages } })`**.
   - On success: parse JSON, **`extractAssistantText`**, append assistant message, fill **`terminalReceipt`** (subnet label, duration, optional **`x402TxHash`** / explorer URL / network), set **`x402Phase`** to `settled`.
   - On failure: **`revertOptimisticUserMessage`**, **`runtimeError`**, clear paying phase; **`finally`** clears loading.
5. **Else (engine)** — set `activeQueryCell`, **`sendMessage`** with `action: "ask"` as before.

Engine WS error handling remains for non-x402 mode; **`engineError`** exposed to the page is **`runtimeError`** in x402 mode (WS **`lastError`** is not mixed into the banner).

### Sessions and sidebar

Draft sessions (new chat with no messages yet) stay **out of `sessions`** until the first message is saved; **`chatHistoryGroups`** only lists sessions with **`messages.length > 0`**. LocalStorage hydrate drops empty sessions for consistency.

## UI (`src/app/intelligence-terminal/page.tsx` and related)

- **Banner** — If x402 mode: shows when wallet not ready or **`engineError`**; copy prompts Base Sepolia / Polygon. If engine mode: WS connection message.
- **`loadingHint`** on **`ChatArea`** — While **`x402Phase === "paying"`**, shows text asking the user to **sign in the wallet** if prompted.
- **`TerminalPanel` / receipt** — If the receipt includes **`x402ExplorerUrl`**, show a **Payment (x402)** link and truncated hash.

## Operational checklist

1. Set **`NEXT_PUBLIC_USE_X402_CHAT=true`** and point **`NEXT_PUBLIC_TELEGRAPH_BASE_URL`** (or **`NEXT_PUBLIC_RESOURCE_SERVER_URL`**) at a node whose **102** chat route speaks x402 over HTTPS (or HTTP for local dev, subject to mixed-content rules in production).
2. Ensure **`NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID`** matches an **`accepts`** entry the facilitator / resource server returns on **402**.
3. Confirm **CORS** on the Telegraph host allows your **`NEXT_PUBLIC_APP_URL`** origin for `POST` + required headers.
4. Connect an injected EVM wallet with the target chain available in wagmi’s chain list.

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
| Chain switch helper | `src/components/wallet/ensure-base-chain.tsx` |
| Terminal page wiring | `src/app/intelligence-terminal/page.tsx` |
| Receipt UI | `src/components/terminal-panel.tsx` |
| Example env | `.env.example` |
