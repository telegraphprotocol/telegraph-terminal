import { NextRequest } from "next/server";
import { backendBase, forwardAuth, proxyPost } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyPost("user/wallet/set-mode", `${backendBase()}/v1/user/wallet/set-mode`, body, forwardAuth(req));
}
