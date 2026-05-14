import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function withCors(res: NextResponse, req: NextRequest): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  );
  const requested = req.headers.get("Access-Control-Request-Headers");
  res.headers.set(
    "Access-Control-Allow-Headers",
    requested ??
      "Content-Type, Authorization, Accept, X-Core-Api-Key, X-Requested-With",
  );
  return res;
}

export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    withCors(res, req);
    res.headers.set("Access-Control-Max-Age", "86400");
    return res;
  }

  const res = NextResponse.next();
  return withCors(res, req);
}

export const config = {
  matcher: "/api/:path*",
};
