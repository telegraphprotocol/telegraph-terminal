import { NextRequest, NextResponse } from "next/server";
import { logApiProxyFetchError, logApiProxyUpstreamError } from "@/lib/api-proxy-log";
import { backendBase, forwardAuth, forwardCookie, copySetCookies } from "@/lib/backend-proxy";

const LOG_TAG = "core/chat/paid";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const url = `${backendBase()}/v1/chat/paid`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...forwardAuth(req),
        ...forwardCookie(req),
      },
      body: body || undefined,
    });
  } catch (err) {
    logApiProxyFetchError(LOG_TAG, url, err);
    return NextResponse.json({ error: "Could not reach Terminal Backend (paid chat)." }, { status: 502 });
  }

  const text = await upstream.text();
  logApiProxyUpstreamError(LOG_TAG, url, upstream.status, text);
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
  copySetCookies(upstream, res);
  return res;
}
