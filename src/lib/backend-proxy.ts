/**
 * Shared helpers for Next.js API routes that proxy to the NestJS backend.
 * Routes that need user auth forward the incoming Authorization: Bearer <jwt>.
 */
import { NextRequest, NextResponse } from "next/server";
import { logApiProxyFetchError, logApiProxyUpstreamError } from "@/lib/api-proxy-log";

export function backendBase(): string {
  return (process.env.TERMINAL_BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3030").replace(/\/$/, "");
}

/** Forward the caller's JWT (if present) to the backend. */
export function forwardAuth(req: NextRequest): HeadersInit {
  const auth = req.headers.get("authorization");
  return auth ? { Authorization: auth } : {};
}

/** Forward the caller's cookies (e.g. the anon free-trial cookie) to the backend. */
export function forwardCookie(req: NextRequest): HeadersInit {
  const cookie = req.headers.get("cookie");
  return cookie ? { Cookie: cookie } : {};
}

/** Copy any Set-Cookie header(s) from the backend's response onto the Next.js response. */
export function copySetCookies(upstream: Response, res: NextResponse): void {
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const values = getSetCookie ? getSetCookie.call(upstream.headers) : [];
  if (values.length > 0) {
    for (const v of values) res.headers.append("Set-Cookie", v);
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) res.headers.append("Set-Cookie", single);
  }
}

export async function proxyGet(
  tag: string,
  url: string,
  headers: HeadersInit = {},
): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(url, { method: "GET", headers, cache: "no-store" });
  } catch (err) {
    logApiProxyFetchError(tag, url, err);
    return NextResponse.json({ error: `Could not reach backend (${tag}).` }, { status: 502 });
  }
  const text = await upstream.text();
  logApiProxyUpstreamError(tag, url, upstream.status, text);
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
  copySetCookies(upstream, res);
  return res;
}

export async function proxyPost(
  tag: string,
  url: string,
  body: string,
  headers: HeadersInit = {},
): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body,
    });
  } catch (err) {
    logApiProxyFetchError(tag, url, err);
    return NextResponse.json({ error: `Could not reach backend (${tag}).` }, { status: 502 });
  }
  const text = await upstream.text();
  logApiProxyUpstreamError(tag, url, upstream.status, text);
  const res = new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
  copySetCookies(upstream, res);
  return res;
}
