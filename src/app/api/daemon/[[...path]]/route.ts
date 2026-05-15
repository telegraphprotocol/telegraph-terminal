import { NextRequest, NextResponse } from "next/server";

function daemonBase(): string {
  const raw = process.env.DAEMON_INTERNAL_URL ?? "http://127.0.0.1:8081";
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
  } catch {
    return NextResponse.json({ error: "Could not reach Daemon." }, { status: 502 });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
