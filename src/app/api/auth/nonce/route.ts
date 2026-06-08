import { NextRequest } from "next/server";
import { backendBase, proxyGet } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  const url = `${backendBase()}/v1/auth/nonce?address=${encodeURIComponent(address)}`;
  return proxyGet("auth/nonce", url);
}
