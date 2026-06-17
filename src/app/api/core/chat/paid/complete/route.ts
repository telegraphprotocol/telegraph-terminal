import { NextRequest } from "next/server";
import { backendBase, forwardAuth, forwardCookie, proxyPost } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyPost(
    "chat/paid/complete",
    `${backendBase()}/v1/chat/paid/complete`,
    body,
    { ...forwardAuth(req), ...forwardCookie(req) },
  );
}
