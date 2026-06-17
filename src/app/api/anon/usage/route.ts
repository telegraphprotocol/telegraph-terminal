import { NextRequest } from "next/server";
import { backendBase, forwardCookie, proxyGet } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  return proxyGet("anon/usage", `${backendBase()}/v1/anon/usage`, forwardCookie(req));
}
