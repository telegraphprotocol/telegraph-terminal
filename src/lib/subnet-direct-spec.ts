
export type SubnetEndpointSpec = {
  path: string;
  method: string;
  description?: string;
  telegraph_direct?: {
    required_payload_keys?: string[];
    /** Optional UI hint for the model field when this endpoint is selected. */
    default_model?: string;
  };
};

export type ParsedSubnetYaml = {
  id: string;
  slug: string;
  name: string;
  endpoints: SubnetEndpointSpec[];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Parse loaded YAML document into a minimal shape for direct-call UI + validation.
 * YAML is loaded from `public/engine-subnets/*.yaml` (bundled with this app). Root and
 * per-endpoint `telegraph_direct` are for Terminal UX only — the engine ignores them.
 */
export function parseSubnetYamlDocument(raw: unknown): ParsedSubnetYaml | null {
  const doc = asRecord(raw);
  if (!doc) return null;
  const idRaw = doc.id;
  const id =
    typeof idRaw === "number"
      ? String(idRaw)
      : typeof idRaw === "string"
        ? idRaw.trim()
        : "";
  const slug = typeof doc.slug === "string" ? doc.slug.trim() : "";
  const name = typeof doc.name === "string" ? doc.name.trim() : slug || `SN${id}`;

  const rootTd = asRecord(doc.telegraph_direct);
  const uiPathsRaw = rootTd?.ui_endpoint_paths;
  const uiPathsFilter =
    Array.isArray(uiPathsRaw) && uiPathsRaw.length > 0
      ? new Set(
          uiPathsRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()),
        )
      : null;

  const eps = doc.endpoints;
  if (!Array.isArray(eps) || eps.length === 0) {
    return { id, slug, name, endpoints: [] };
  }
  const endpoints: SubnetEndpointSpec[] = [];
  for (const e of eps) {
    const er = asRecord(e);
    if (!er) continue;
    const path = typeof er.path === "string" ? er.path.trim() : "";
    if (!path) continue;
    const methodRaw = typeof er.method === "string" ? er.method.trim().toUpperCase() : "POST";
    const td = asRecord(er.telegraph_direct);
    const required_payload_keys = Array.isArray(td?.required_payload_keys)
      ? (td!.required_payload_keys as unknown[])
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : undefined;
    const defaultModelRaw = td?.default_model;
    const default_model =
      typeof defaultModelRaw === "string" && defaultModelRaw.trim().length > 0
        ? defaultModelRaw.trim()
        : undefined;
    const hasTd = Boolean(required_payload_keys?.length || default_model);
    endpoints.push({
      path,
      method: methodRaw || "POST",
      description: typeof er.description === "string" ? er.description : undefined,
      telegraph_direct: hasTd
        ? {
            ...(required_payload_keys?.length ? { required_payload_keys } : {}),
            ...(default_model ? { default_model } : {}),
          }
        : undefined,
    });
  }

  let finalEndpoints = endpoints;
  if (uiPathsFilter) {
    const next = endpoints.filter((e) => uiPathsFilter.has(e.path));
    if (next.length > 0) finalEndpoints = next;
  }

  return { id, slug, name, endpoints: finalEndpoints };
}

type IntegrationEndpoint = {
  path: string;
  method?: string;
  description?: string;
};

type IntegrationRecord = {
  id: string;
  slug: string;
  name: string;
  endpoints?: IntegrationEndpoint[];
  input_schema?: {
    required?: string[];
    properties?: Record<string, { description?: string; default?: unknown }>;
  };
};

let _integrationsCache: IntegrationRecord[] | null = null;

async function fetchIntegrations(): Promise<IntegrationRecord[]> {
  if (_integrationsCache) return _integrationsCache;
  try {
    const res = await fetch("/api/engine/miner-dispatcher/integrations", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as IntegrationRecord[];
    _integrationsCache = Array.isArray(data) ? data : [];
    return _integrationsCache;
  } catch {
    return [];
  }
}

function integrationToSubnetYaml(rec: IntegrationRecord): ParsedSubnetYaml {
  const endpoints: SubnetEndpointSpec[] = (rec.endpoints ?? []).map((ep) => {
    const method = (ep.method ?? "POST").toUpperCase();
    const requiredKeys = rec.input_schema?.required ?? [];
    return {
      path: ep.path,
      method,
      description: ep.description,
      telegraph_direct: requiredKeys.length > 0 ? { required_payload_keys: requiredKeys } : undefined,
    };
  });
  return { id: rec.id, slug: rec.slug, name: rec.name, endpoints };
}

export async function fetchSubnetYamlBySlug(slug: string): Promise<ParsedSubnetYaml | null> {
  const integrations = await fetchIntegrations();
  const rec = integrations.find((r) => r.slug === slug);
  if (!rec) return null;
  return integrationToSubnetYaml(rec);
}

export function pickDefaultEndpoint(spec: ParsedSubnetYaml): SubnetEndpointSpec | null {
  const prefer = spec.endpoints.find((e) => e.path === "/chat");
  return prefer ?? spec.endpoints[0] ?? null;
}

export function findEndpoint(spec: ParsedSubnetYaml, path: string): SubnetEndpointSpec | null {
  const p = path.trim();
  return spec.endpoints.find((e) => e.path === p) ?? null;
}

/** Default `model` from the endpoint's `telegraph_direct.default_model` in engine YAML. */
export function getDefaultDirectModelForSpec(
  spec: ParsedSubnetYaml,
  endpointPath: string,
): string | undefined {
  const ep = findEndpoint(spec, endpointPath);
  const m = ep?.telegraph_direct?.default_model;
  return typeof m === "string" && m.trim().length > 0 ? m.trim() : undefined;
}

/** Returns required field names that are missing or empty in `payload`. */
export function missingPayloadKeys(
  endpoint: SubnetEndpointSpec,
  payload: Record<string, unknown>,
): string[] {
  const req = endpoint.telegraph_direct?.required_payload_keys;
  if (!req?.length) return [];
  const miss: string[] = [];
  for (const key of req) {
    const v = payload[key];
    if (v === undefined || v === null) {
      miss.push(key);
      continue;
    }
    if (key === "lat" || key === "lon") {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : Number.NaN;
      if (!Number.isFinite(n)) {
        miss.push(key);
      }
      continue;
    }
    if (typeof v === "string" && !v.trim()) {
      miss.push(key);
      continue;
    }
    if (key === "messages" && Array.isArray(v) && v.length === 0) {
      miss.push(key);
    }
  }
  return miss;
}

export type DirectFieldBag = {
  model: string;
  imageUrl: string;
  lat: string;
  lon: string;
};

export type ValidateDirectPayloadResult =
  | { ok: true }
  | { ok: false; missing: string[]; message: string };

/**
 * Validates a built JSON payload for a subnet direct call (required keys from YAML
 * `telegraph_direct.required_payload_keys`).
 */
export function validateDirectPayload(
  subnetId: string,
  endpointPath: string,
  spec: ParsedSubnetYaml,
  payload: Record<string, unknown>,
): ValidateDirectPayloadResult {
  const ep = findEndpoint(spec, endpointPath);
  if (!ep) {
    return {
      ok: false,
      missing: [],
      message: `Cannot send: unknown endpoint \`${endpointPath}\` for ${spec.name} (SN${subnetId}).`,
    };
  }

  const declared = ep.telegraph_direct?.required_payload_keys;
  const hasDeclared = Boolean(declared?.length);
  const payloadEmpty =
    payload == null ||
    (typeof payload === "object" &&
      !Array.isArray(payload) &&
      Object.keys(payload as Record<string, unknown>).length === 0);

  if (!hasDeclared && ep.path === "/chat") {
    const model = payload.model;
    const messages = payload.messages;
    const mMiss: string[] = [];
    if (typeof model !== "string" || !model.trim()) mMiss.push("model");
    if (!Array.isArray(messages) || messages.length === 0) mMiss.push("messages");
    if (mMiss.length) {
      const fieldList = mMiss.map((k) => `\`${k}\``).join(", ");
      return {
        ok: false,
        missing: mMiss,
        message: `Cannot send — ${spec.name} (SN${subnetId}), \`POST /chat\`: missing or empty ${fieldList}.`,
      };
    }
  }

  if (!hasDeclared && ep.path !== "/chat" && ep.method !== "GET") {
    if (payloadEmpty) {
      return {
        ok: false,
        missing: [],
        message: `Cannot send: ${spec.name} (SN${subnetId}) ${ep.method} \`${ep.path}\` has no \`telegraph_direct.required_payload_keys\`. Add it under this endpoint in \`public/engine-subnets/{slug}.yaml\`.`,
      };
    }
  }

  const missing = missingPayloadKeys(ep, payload);
  if (missing.length) {
    const fieldList = missing.map((k) => `\`${k}\``).join(", ");
    return {
      ok: false,
      missing,
      message: `Cannot send — ${spec.name} (SN${subnetId}), \`${ep.method} ${ep.path}\`: missing or empty ${fieldList}.`,
    };
  }

  return { ok: true };
}

/**
 * Build a JSON payload for the selected endpoint using chat text + known UI fields.
 */
export function buildDirectPayload(
  endpoint: SubnetEndpointSpec,
  userText: string,
  fields: DirectFieldBag,
): Record<string, unknown> {
  const req = endpoint.telegraph_direct?.required_payload_keys ?? [];
  const payload: Record<string, unknown> = {};

  if (req.length === 0) {
    if (endpoint.path === "/chat") {
      return {
        model: fields.model.trim(),
        messages: [{ role: "user", content: userText.trim() || " " }],
      };
    }
    return {};
  }

  for (const key of req) {
    if (key === "messages") {
      payload.messages = [{ role: "user", content: userText.trim() || " " }];
    } else if (key === "model") {
      payload.model = fields.model.trim();
    } else if (key === "image") {
      payload.image = fields.imageUrl.trim();
    } else if (key === "lat") {
      payload.lat = Number.parseFloat(fields.lat.trim());
    } else if (key === "lon") {
      payload.lon = Number.parseFloat(fields.lon.trim());
    } else if (key === "input") {
      payload.input = userText.trim();
    } else {
      payload[key] = userText.trim();
    }
  }

  return payload;
}

export type PaidDirectCallBody = {
  subnetId: string;
  direct: {
    method: string;
    endpoint: string;
    payload: Record<string, unknown>;
  };
};

export function computePaidDirectBody(
  subnetId: string,
  spec: ParsedSubnetYaml,
  endpointPath: string,
  userLine: string,
  fields: DirectFieldBag,
): { ok: true; body: PaidDirectCallBody } | { ok: false; error: string } {
  const ep = findEndpoint(spec, endpointPath);
  if (!ep) {
    return { ok: false, error: "Selected endpoint was not found in the subnet YAML." };
  }
  const payload = buildDirectPayload(ep, userLine, fields);
  const validation = validateDirectPayload(subnetId, endpointPath, spec, payload);
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }
  return {
    ok: true,
    body: {
      subnetId,
      direct: {
        method: ep.method,
        endpoint: ep.path,
        payload,
      },
    },
  };
}
