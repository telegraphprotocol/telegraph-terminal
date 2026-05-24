import { NextRequest } from "next/server";
import { backendBase, forwardAuth, proxyGet } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  return proxyGet("auth/me", `${backendBase()}/v1/auth/me`, forwardAuth(req));
}
