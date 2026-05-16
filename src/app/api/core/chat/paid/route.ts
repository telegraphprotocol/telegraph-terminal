import { NextRequest, NextResponse } from "next/server";
import {
  logApiProxyConfig,
  logApiProxyFetchError,
  logApiProxyUpstreamError,
} from "@/lib/api-proxy-log";

const LOG_TAG = "core/chat/paid";

function terminalBackendBase(): string {
  const raw =
    process.env.TERMINAL_BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3030";
  return raw.replace(/\/$/, "");
}

/**
 * Server-side proxy to Terminal Backend `POST /v1/chat/paid`.
 */
export async function POST(req: NextRequest) {
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

  const body = await req.text();
  const url = `${terminalBackendBase()}/v1/chat/paid`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Core-Api-Key": key.trim(),
      },
      body: body || undefined,
    });
  } catch (err) {
    logApiProxyFetchError(LOG_TAG, url, err);
    return NextResponse.json(
      { error: "Could not reach Terminal Backend (paid chat)." },
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
