import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json(
      {
        error:
          "TERMINAL_BACKEND_API_KEY is not set on the Next server (see .env.example).",
      },
      { status: 500 },
    );
  }

  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${terminalBackendBase()}/v1/chat/paid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Core-Api-Key": key.trim(),
      },
      body: body || undefined,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach Terminal Backend (paid chat)." }, { status: 502 });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
