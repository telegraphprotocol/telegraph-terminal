import {
  DaemonCategoriesResponse,
  DaemonHealthResponse,
  DaemonPage,
  DaemonQueryParams,
  EngineHttpAskResponse,
  EngineHttpDirectAskResponse,
  EngineListSubnetsResponse,
} from "@/lib/engine-daemon-types";

const ENGINE_PROXY_PREFIX = "/api/engine";
const DAEMON_PROXY_PREFIX = "/api/daemon";

function toDaemonUrl(path: string, query?: DaemonQueryParams): string {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      params.append(key, String(value));
    });
  }
  const qs = params.toString();
  const querySuffix = qs.length > 0 ? `?${qs}` : "";
  return `${DAEMON_PROXY_PREFIX}${path}${querySuffix}`;
}

export const apiClient = {
  // Engine API (proxied by Next → ENGINE_INTERNAL_URL)
  async smartAsk(query: string, context?: Record<string, unknown>): Promise<EngineHttpAskResponse> {
    const response = await fetch(`${ENGINE_PROXY_PREFIX}/v1/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, ...(context ? { context } : {}) }),
    });
    if (!response.ok) throw new Error("Engine API error");
    return response.json();
  },

  async directAsk(subnetId: string, endpoint: string, payload: unknown): Promise<EngineHttpDirectAskResponse> {
    const response = await fetch(`${ENGINE_PROXY_PREFIX}/v1/ask/${subnetId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, payload }),
    });
    if (!response.ok) throw new Error("Engine API error");
    return response.json();
  },

  async listSubnets(): Promise<EngineListSubnetsResponse> {
    const response = await fetch(`${ENGINE_PROXY_PREFIX}/v1/subnets`);
    if (!response.ok) throw new Error("Engine API error");
    return response.json();
  },

  // Daemon API (proxied by Next → DAEMON_INTERNAL_URL)
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
    const response = await fetch(`${DAEMON_PROXY_PREFIX}/api/categories`);
    if (!response.ok) throw new Error("Daemon API error");
    return response.json();
  },

  async getHealth(): Promise<DaemonHealthResponse> {
    const response = await fetch(`${DAEMON_PROXY_PREFIX}/health`);
    if (!response.ok) throw new Error("Daemon API error");
    return response.json();
  },
};
