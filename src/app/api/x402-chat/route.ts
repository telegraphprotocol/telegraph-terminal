import { NextRequest, NextResponse } from "next/server";
import { getTelegraphChatUpstreamUrl } from "@/lib/x402-telegraph-fetch";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
]);

/**
 * Same-origin proxy for subnet chat POSTs so the browser can read x402 headers
 * (`PAYMENT-REQUIRED`, `PAYMENT-RESPONSE`). Cross-origin responses only expose
 * CORS-listed headers; many dispatchers omit `Access-Control-Expose-Headers`
 * for those, which breaks `@x402/fetch` with "Invalid payment required response".
 */
export async function POST(req: NextRequest) {
  const target = getTelegraphChatUpstreamUrl();
  if (!target.startsWith("http")) {
    return NextResponse.json({ error: "Telegraph chat URL is not configured" }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") ?? "application/json";
  const accept = req.headers.get("accept") ?? "application/json";
  const paymentSignature =
    req.headers.get("payment-signature") ?? req.headers.get("PAYMENT-SIGNATURE");
  const xPayment = req.headers.get("x-payment") ?? req.headers.get("X-PAYMENT");

  const headers = new Headers({
    "Content-Type": contentType,
    Accept: accept,
  });
  if (paymentSignature) headers.set("PAYMENT-SIGNATURE", paymentSignature);
  if (xPayment) headers.set("X-PAYMENT", xPayment);

  const body = await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers,
      body: body.byteLength ? body : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    outHeaders.append(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}
