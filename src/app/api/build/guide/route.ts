import { NextRequest } from "next/server";
import { backendBase, proxyPost } from "@/lib/backend-proxy";

export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyPost("build-guide", `${backendBase()}/v1/build/guide`, body);
}
