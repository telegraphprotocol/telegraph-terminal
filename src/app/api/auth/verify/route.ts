import { NextRequest } from "next/server";
import { backendBase, proxyPost } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyPost("auth/verify", `${backendBase()}/v1/auth/verify`, body);
}
