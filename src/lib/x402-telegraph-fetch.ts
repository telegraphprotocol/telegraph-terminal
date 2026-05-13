/**
 * Browser x402 over HTTP against Telegraph subnet-dispatcher.
 *
 * Cross-origin: the browser uses same-origin `/api/x402-chat` by default so
 * `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` are readable (CORS often hides them).
 */
import {
  wrapFetchWithPayment,
  x402Client,
  decodePaymentResponseHeader,
  type SelectPaymentRequirements,
} from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import type { PaymentRequirements, SettleResponse } from "@x402/core/types";
import type { PublicClient, WalletClient } from "viem";

const DEFAULT_CHAT_PATH = "/subnet-dispatcher/v1/102/chat";

export function getTelegraphBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAPH_BASE_URL ||
    process.env.NEXT_PUBLIC_RESOURCE_SERVER_URL ||
    "";
  return raw.replace(/\/$/, "");
}

export function getSubnetChatPath(): string {
  return process.env.NEXT_PUBLIC_SUBNET_GROQ_CHAT_PATH || DEFAULT_CHAT_PATH;
}

/** Direct dispatcher URL (used by the server proxy and SSR). */
export function getTelegraphChatUpstreamUrl(): string {
  return `${getTelegraphBaseUrl()}${getSubnetChatPath()}`;
}

/**
 * URL the browser `fetch` uses for paid chat. Uses `/api/x402-chat` when the
 * dispatcher is on another origin so x402 headers are not stripped by CORS.
 */
export function getTelegraphChatUrl(): string {
  const upstream = getTelegraphChatUpstreamUrl();
  if (typeof globalThis.window === "undefined") return upstream;

  const mode = process.env.NEXT_PUBLIC_X402_CHAT_USE_PROXY;
  if (mode === "false") return upstream;
  if (mode === "true") return `${globalThis.window.location.origin}/api/x402-chat`;

  try {
    const u = new URL(upstream);
    if (u.origin !== globalThis.window.location.origin) {
      return `${globalThis.window.location.origin}/api/x402-chat`;
    }
  } catch {
    /* keep upstream */
  }
  return upstream;
}

function parseEip155ChainId(network: string): number | null {
  const m = /^eip155:(\d+)$/.exec(network.trim());
  return m ? Number(m[1]) : null;
}

/** Prefer a 402 `accepts` entry whose network matches the wallet's current chain. */
export function createChainMatchingSelector(
  walletChainId: number,
): SelectPaymentRequirements {
  return (_version: number, accepts: PaymentRequirements[]) => {
    if (!accepts?.length) throw new Error("No payment options in 402 response");
    const match = accepts.find((req) => parseEip155ChainId(req.network) === walletChainId);
    return match ?? accepts[0];
  };
}

export function buildEvmX402PaidFetch(
  walletClient: WalletClient,
  publicClient: PublicClient | undefined,
  walletChainId: number,
): typeof fetch {
  const account = walletClient.account;
  if (!account) {
    throw new Error("Wallet client has no active account");
  }
  const evmSigner = toClientEvmSigner(
    {
      address: account.address,
      signTypedData: (msg) =>
        walletClient.signTypedData({
          account,
          ...msg,
        } as Parameters<WalletClient["signTypedData"]>[0]),
    },
    publicClient,
  );
  const client = x402Client.fromConfig({
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(evmSigner) }],
    paymentRequirementsSelector: createChainMatchingSelector(walletChainId),
  });
  return wrapFetchWithPayment(fetch, client);
}

export function settlementFromResponse(response: Response): SettleResponse | null {
  const header =
    response.headers.get("PAYMENT-RESPONSE") ??
    response.headers.get("payment-response") ??
    response.headers.get("X-PAYMENT-RESPONSE") ??
    response.headers.get("x-payment-response") ??
    response.headers.get("x-payment-settle-response");
  if (!header) return null;
  try {
    return decodePaymentResponseHeader(header);
  } catch {
    return null;
  }
}

/**
 * EVM transaction explorer URL for a known chain id.
 * Unknown chains return null (avoid defaulting to Polygon for every 0x hash).
 */
function evmTxExplorerUrl(chainId: number, tx: string): string | null {
  if (chainId === 137) {
    const base =
      process.env.NEXT_PUBLIC_POLYGON_EXPLORER_TX_URL || "https://polygonscan.com/tx";
    return `${base.replace(/\/$/, "")}/${tx}`;
  }
  if (chainId === 84532) {
    return `https://sepolia.basescan.org/tx/${tx}`;
  }
  if (chainId === 8453) {
    return `https://basescan.org/tx/${tx}`;
  }
  if (chainId === 1) {
    return `https://etherscan.io/tx/${tx}`;
  }
  return null;
}

/**
 * Build explorer URL from settlement metadata.
 * Uses `eip155:<id>` from `settle.network` when parseable; otherwise `paymentChainId`
 * (the chain the app used for x402 signing) so missing headers still link correctly.
 */
export function explorerUrlForSettlement(
  settle: SettleResponse,
  paymentChainId?: number,
): string | null {
  const tx = settle.transaction;
  if (!tx) return null;
  const net = settle.network ?? "";

  if (net.startsWith("solana:")) {
    const base = process.env.NEXT_PUBLIC_SOLANA_EXPLORER_TX_URL || "https://explorer.solana.com/tx";
    const q = process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER_QUERY ?? "";
    return `${base.replace(/\/$/, "")}/${tx}${q}`;
  }

  const parsed = parseEip155ChainId(net);
  const effectiveChainId = parsed ?? paymentChainId;
  if (effectiveChainId != null && Number.isFinite(effectiveChainId)) {
    return evmTxExplorerUrl(effectiveChainId, tx);
  }

  return null;
}
