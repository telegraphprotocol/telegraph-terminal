import {
  DaemonCategoriesResponse,
  DaemonHealthResponse,
  DaemonPage,
  DaemonQueryParams,
  EngineHttpAskResponse,
  EngineHttpDirectAskResponse,
  EngineListSubnetsResponse,
} from "@/lib/engine-daemon-types";

const ENGINE_API_URL = process.env.NEXT_PUBLIC_ENGINE_API_URL || "http://localhost:7044";
const DAEMON_API_URL = process.env.NEXT_PUBLIC_DAEMON_API_URL || "http://localhost:8081";

function toDaemonUrl(path: string, query?: DaemonQueryParams) {
  const url = new URL(`${DAEMON_API_URL}${path}`);
  if (!query) return url.toString();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

export const apiClient = {
  // Engine API
  async smartAsk(query: string, context?: Record<string, unknown>): Promise<EngineHttpAskResponse> {
    const response = await fetch(`${ENGINE_API_URL}/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, ...(context ? { context } : {}) }),
    });
    if (!response.ok) throw new Error("Engine API error");
    return response.json();
  },

  async directAsk(subnetId: string, endpoint: string, payload: unknown): Promise<EngineHttpDirectAskResponse> {
    const response = await fetch(`${ENGINE_API_URL}/v1/ask/${subnetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, payload }),
    });
    if (!response.ok) throw new Error("Engine API error");
    return response.json();
  },

  async listSubnets(): Promise<EngineListSubnetsResponse> {
    const response = await fetch(`${ENGINE_API_URL}/v1/subnets`);
    if (!response.ok) throw new Error("Engine API error");
    return response.json();
  },

  // Daemon API
  async fetchSignals(query: DaemonQueryParams = {}): Promise<DaemonPage> {
    const response = await fetch(toDaemonUrl("/api/questions", query));
    if (!response.ok) throw new Error("Daemon API error");
    return response.json();
  },

  async getTopSignals(query: DaemonQueryParams = {}): Promise<DaemonPage> {
    const response = await fetch(toDaemonUrl("/api/questions/top", query));
    if (!response.ok) throw new Error("Daemon API error");
    return response.json();
  },

  async getCategories(): Promise<DaemonCategoriesResponse> {
    const response = await fetch(`${DAEMON_API_URL}/api/categories`);
    if (!response.ok) throw new Error("Daemon API error");
    return response.json();
  },

  async getHealth(): Promise<DaemonHealthResponse> {
    const response = await fetch(`${DAEMON_API_URL}/health`);
    if (!response.ok) throw new Error("Daemon API error");
    return response.json();
  },
};
