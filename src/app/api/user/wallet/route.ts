import { NextRequest } from "next/server";
import { backendBase, forwardAuth, proxyGet } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  const externalAddress = req.nextUrl.searchParams.get("externalAddress") ?? "";
  const qs = externalAddress ? `?externalAddress=${encodeURIComponent(externalAddress)}` : "";
  return proxyGet("user/wallet", `${backendBase()}/v1/user/wallet${qs}`, forwardAuth(req));
}
