import { NextResponse } from "next/server";

function coreBase(): string {
  const raw = process.env.CORE_INTERNAL_URL ?? "http://127.0.0.1:3030";
  return raw.replace(/\/$/, "");
}

/**
 * Server-side proxy to Terminal Backend `GET /v1/wallet` so the browser never holds `CORE_API_KEY`.
 */
export async function GET() {
  const key = process.env.CORE_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json(
      { error: "CORE_API_KEY is not set on the Next server (see .env.example)." },
      { status: 500 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${coreBase()}/v1/wallet`, {
      method: "GET",
      headers: { "X-Core-Api-Key": key.trim() },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Terminal Backend (wallet)." }, { status: 502 });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
