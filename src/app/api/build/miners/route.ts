import { NextRequest } from "next/server";
import { backendBase, proxyGet } from "@/lib/backend-proxy";

export async function GET(_req: NextRequest) {
  return proxyGet("build-miners", `${backendBase()}/v1/build/miners`);
}
