import { NextRequest } from "next/server";
import { backendBase, forwardAuth, proxyGet } from "@/lib/backend-proxy";

export async function GET(req: NextRequest) {
  return proxyGet("receipts", `${backendBase()}/v1/receipts`, forwardAuth(req));
}
