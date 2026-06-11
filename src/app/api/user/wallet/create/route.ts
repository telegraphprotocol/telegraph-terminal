import { NextRequest } from "next/server";
import { backendBase, forwardAuth, proxyPost } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  return proxyPost("user/wallet/create", `${backendBase()}/v1/user/wallet/create`, "{}", forwardAuth(req));
}
