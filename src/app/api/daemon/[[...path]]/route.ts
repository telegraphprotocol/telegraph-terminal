import { NextRequest, NextResponse } from "next/server";
import {
  logApiProxyConfig,
  logApiProxyFetchError,
  logApiProxyUpstreamError,
} from "@/lib/api-proxy-log";

const LOG_TAG = "daemon";

function daemonBase(): string {
  const raw = process.env.DAEMON_INTERNAL_URL ?? "http://127.0.0.1:7044";
  return raw.replace(/\/$/, "");
}

function upstreamPath(segments: string[] | undefined): string {
  const tail = (segments ?? []).join("/");
  return tail ? `/${tail}` : "";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const rel = upstreamPath(path);
  if (!rel) {
    logApiProxyConfig(LOG_TAG, "Missing daemon path segment in /api/daemon/* request.");
    return NextResponse.json({ error: "Missing daemon path." }, { status: 404 });
  }

  const search = req.nextUrl.search;
  const url = `${daemonBase()}${rel}${search}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    logApiProxyFetchError(LOG_TAG, url, err);
    return NextResponse.json({ error: "Could not reach Daemon." }, { status: 502 });
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
