import { NextRequest, NextResponse } from "next/server";
import {
  logApiProxyConfig,
  logApiProxyFetchError,
  logApiProxyUpstreamError,
} from "@/lib/api-proxy-log";

const LOG_TAG = "core/wallet";

function terminalBackendBase(): string {
  const raw =
    process.env.TERMINAL_BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3030";
  return raw.replace(/\/$/, "");
}

/**
 * Server-side proxy for wallet info.
 * - With Authorization header: proxies to `GET /user/wallet` (EVM) or `/user/wallet/solana-balance` (Solana).
 * - Without: falls back to `GET /v1/wallet` (EVM admin) or `/v1/wallet/solana` (Solana admin).
 * Accepts ?network=solana to return Solana wallet info instead of EVM.
 */
export async function GET(req: NextRequest) {
  const key = process.env.TERMINAL_BACKEND_API_KEY;
  if (!key?.trim()) {
    logApiProxyConfig(
      LOG_TAG,
      "TERMINAL_BACKEND_API_KEY is not set on the Next server (see .env.example).",
    );
    return NextResponse.json(
      { error: "TERMINAL_BACKEND_API_KEY is not set on the Next server (see .env.example)." },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization");
  const backendBase = terminalBackendBase();
  const network = req.nextUrl.searchParams.get("network") ?? "base-sepolia";
  const isSolana = network === "solana";

  // Authenticated user — return their Privy wallet info for the selected network
  if (authHeader) {
    const url = isSolana
      ? `${backendBase}/user/wallet/solana-balance`
      : `${backendBase}/user/wallet`;
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: authHeader,
          "X-Core-Api-Key": key.trim(),
        },
        cache: "no-store",
      });
    } catch (err) {
      logApiProxyFetchError(LOG_TAG, url, err);
      return NextResponse.json({ error: "Could not reach Terminal Backend (wallet)." }, { status: 502 });
    }

    if (upstream.ok) {
      if (isSolana) {
        const data = (await upstream.json()) as {
          privySolanaWalletAddress?: string | null;
          privySolanaUsdcBalance?: string;
        };
        return NextResponse.json({
          address: data.privySolanaWalletAddress ?? "",
          usdcBalance: data.privySolanaUsdcBalance ?? "0",
          nativeBalanceFormatted: "0",
          chainId: 0,
        });
      } else {
        const data = (await upstream.json()) as {
          walletMode?: string;
          address?: string;
          privyWalletAddress?: string | null;
          usdcBalance?: string;
        };
        const address = data.privyWalletAddress ?? data.address ?? "";
        return NextResponse.json({
          address,
          usdcBalance: data.usdcBalance ?? "0",
          nativeBalanceFormatted: "0",
          chainId: 0,
        });
      }
    }

    // JWT present but user wallet failed — fall through to admin wallet
    logApiProxyUpstreamError(LOG_TAG, url, upstream.status, await upstream.text().catch(() => ""));
  }

  // No auth or user wallet unavailable — return admin wallet snapshot
  const adminUrl = isSolana ? `${backendBase}/v1/wallet/solana` : `${backendBase}/v1/wallet`;
  let upstream: Response;
  try {
    upstream = await fetch(adminUrl, {
      method: "GET",
      headers: { "X-Core-Api-Key": key.trim() },
      cache: "no-store",
    });
  } catch (err) {
    logApiProxyFetchError(LOG_TAG, adminUrl, err);
    return NextResponse.json({ error: "Could not reach Terminal Backend (wallet)." }, { status: 502 });
  }

  if (upstream.ok) {
    const data = await upstream.json() as { address?: string; usdcBalance?: string; nativeBalanceFormatted?: string; chainId?: number };
    return NextResponse.json({
      address: data.address ?? "",
      usdcBalance: data.usdcBalance ?? "0",
      nativeBalanceFormatted: data.nativeBalanceFormatted ?? "0",
      chainId: data.chainId ?? 0,
    });
  }

  const text = await upstream.text();
  logApiProxyUpstreamError(LOG_TAG, adminUrl, upstream.status, text);
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
