import { NextResponse } from "next/server";
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
 * Server-side proxy to Terminal Backend `GET /v1/wallet` so the browser never holds `TERMINAL_BACKEND_API_KEY`.
 */
export async function GET() {
  const key = process.env.TERMINAL_BACKEND_API_KEY;
  if (!key?.trim()) {
    logApiProxyConfig(
      LOG_TAG,
      "TERMINAL_BACKEND_API_KEY is not set on the Next server (see .env.example).",
    );
    return NextResponse.json(
      {
        error:
          "TERMINAL_BACKEND_API_KEY is not set on the Next server (see .env.example).",
      },
      { status: 500 },
    );
  }

  const url = `${terminalBackendBase()}/v1/wallet`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: { "X-Core-Api-Key": key.trim() },
      cache: "no-store",
    });
  } catch (err) {
    logApiProxyFetchError(LOG_TAG, url, err);
    return NextResponse.json(
      { error: "Could not reach Terminal Backend (wallet)." },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  logApiProxyUpstreamError(LOG_TAG, url, upstream.status, text);
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
