import { NextRequest, NextResponse } from "next/server";
import {
  logApiProxyConfig,
  logApiProxyFetchError,
  logApiProxyUpstreamError,
} from "@/lib/api-proxy-log";

const LOG_TAG = "engine";

function engineBase(): string {
  const raw = process.env.ENGINE_INTERNAL_URL ?? "http://127.0.0.1:7044";
  return raw.replace(/\/$/, "");
}

function upstreamPath(segments: string[] | undefined): string {
  const tail = (segments ?? []).join("/");
  return tail ? `/${tail}` : "";
}

async function proxyEngine(
  req: NextRequest,
  segments: string[] | undefined,
  method: "GET" | "POST",
): Promise<NextResponse> {
  const path = upstreamPath(segments);
  if (!path) {
    logApiProxyConfig(LOG_TAG, "Missing engine path segment in /api/engine/* request.");
    return NextResponse.json({ error: "Missing engine path." }, { status: 404 });
  }

  const search = req.nextUrl.search;
  const url = `${engineBase()}${path}${search}`;

  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (method === "POST") {
    const ct = req.headers.get("content-type");
    if (ct) headers["Content-Type"] = ct;
    body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? body || undefined : undefined,
      cache: "no-store",
    });
  } catch (err) {
    logApiProxyFetchError(LOG_TAG, url, err);
    return NextResponse.json({ error: "Could not reach Engine." }, { status: 502 });
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyEngine(req, path, "GET");
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await ctx.params;
  return proxyEngine(req, path, "POST");
}
