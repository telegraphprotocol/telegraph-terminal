/**
 * Browser x402 over HTTP against Telegraph subnet-dispatcher.
 *
 * Verified against operator: POST without payment returns 402 + `Payment-Required` header;
 * `Access-Control-Allow-Origin: *` on sample dispatcher (browser CORS OK for simple fetch).
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

export function getTelegraphChatUrl(): string {
  return `${getTelegraphBaseUrl()}${getSubnetChatPath()}`;
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

export function explorerUrlForSettlement(settle: SettleResponse): string | null {
  const tx = settle.transaction;
  if (!tx) return null;
  const net = settle.network ?? "";

  if (net.startsWith("solana:")) {
    const base = process.env.NEXT_PUBLIC_SOLANA_EXPLORER_TX_URL || "https://explorer.solana.com/tx";
    const q = process.env.NEXT_PUBLIC_SOLANA_EXPLORER_CLUSTER_QUERY ?? "";
    return `${base.replace(/\/$/, "")}/${tx}${q}`;
  }

  const chainId = parseEip155ChainId(net);
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

  if (tx.startsWith("0x")) {
    const base =
      process.env.NEXT_PUBLIC_POLYGON_EXPLORER_TX_URL || "https://polygonscan.com/tx";
    return `${base.replace(/\/$/, "")}/${tx}`;
  }

  return null;
}
