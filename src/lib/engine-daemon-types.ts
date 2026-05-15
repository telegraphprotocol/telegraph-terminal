export type EngineWsEventType =
  | "connected"
  | "received"
  | "routing"
  | "routed"
  | "executing"
  | "result"
  | "error"
  | "pong";

export type EngineAskAction = {
  action: "ask";
  query: string;
  context?: Record<string, unknown>;
};

export type EngineAskDirectAction = {
  action: "ask_direct";
  subnet_id: string;
  endpoint: string;
  payload: unknown;
};

export type EngineListSubnetsAction = {
  action: "list_subnets";
};

export type EnginePingAction = {
  action: "ping";
};

/** `/v1/subnets` — keep loose; normalize via `normalizeEngineSubnets`. */
export type EngineListSubnetsResponse = {
  subnets?: unknown[];
  count?: number;
};

export type EngineWsAction =
  | EngineAskAction
  | EngineAskDirectAction
  | EngineListSubnetsAction
  | EnginePingAction;

export type EngineAskResult = {
  subnet_used?: string;
  subnet_id?: string;
  subnet_name: string;
  result: unknown;
  cost_usd: number;
  duration_ms: number;
  timestamp: string;
  reasoning?: string;
  intent?: string;
};

export type EngineHttpAskResponse = {
  subnet_used: string;
  subnet_name: string;
  result: unknown;
  cost_usd: number;
  duration_ms: number;
  timestamp: string;
  reasoning?: string;
  intent?: string;
};

export type EngineHttpDirectAskResponse = {
  subnet_id: string;
  subnet_name: string;
  result: unknown;
  cost_usd: number;
  duration_ms: number;
  timestamp: string;
};

export type EngineWsFrame = {
  type: EngineWsEventType;
  data?: Record<string, unknown>;
  timestamp: string;
};

export type DaemonCategory =
  | "POLITICS"
  | "ECONOMICS"
  | "GEOPOLITICS"
  | "TECHNOLOGY"
  | "CLIMATE"
  | "HEALTH"
  | "FINANCE"
  | "CRYPTO"
  | "SPORTS"
  | "SCIENCE"
  | "SOCIAL"
  | "OTHER";

export type DaemonQuestionDoc = {
  text: string;
  category: DaemonCategory | "";
  interest_score: number;
  affected_pct: number;
  audience_pct: number;
  /**
   * Article / data URL when the collector stored one. Use `""` or omit when unknown;
   * the UI treats missing and empty (after trim) as no link.
   */
  source_url?: string;
};

export type DaemonRoutingMeta = {
  subnet_id?: string;
  subnet_name?: string;
  reasoning?: string;
  intent?: string;
  error_stage?: "routing" | "execution" | "lookup";
};

export type DaemonExecutionMeta = {
  result: unknown | null;
  cost_usd: number;
  duration_ms: number;
  timestamp: string;
  error?: string;
};

export type DaemonResultItem = {
  id: string;
  type: "daemon" | "direct";
  source: string;
  status: "success" | "error";
  created_at: string;
  question: DaemonQuestionDoc;
  routing: DaemonRoutingMeta;
  execution: DaemonExecutionMeta;
};

export type DaemonPage = {
  results: DaemonResultItem[];
  total: number;
  limit: number;
  offset: number;
};

export type DaemonCategoryStat = {
  category: string;
  count: number;
  avg_interest: number;
  max_interest: number;
};

export type DaemonCategoriesResponse = {
  stats: DaemonCategoryStat[];
  categories: DaemonCategory[];
};

export type DaemonHealthResponse = {
  status: string;
  time: string;
};

export type DaemonQueryParams = {
  category?: string;
  source?: string;
  sort?: "recent" | "interest" | "affected" | "audience";
  order?: "asc" | "desc";
  since?: string;
  until?: string;
  since_hours?: number;
  min_interest?: number;
  min_affected?: number;
  min_audience?: number;
  limit?: number;
  offset?: number;
};
