export type ForecastRow = {
  time: string;
  temperature_c?: string;
  wind_kph?: string;
  rain_mm?: string;
  value?: string;
  variable?: string;
};

export type ResultBadge = {
  label: string;
  value: string;
};

export type KeyValueRow = {
  label: string;
  value: string;
};

export type StructuredResultSection =
  | { type: "text"; title?: string; body: string }
  | { type: "citations"; links: string[] }
  | { type: "forecast"; location?: string; rows: ForecastRow[] }
  | { type: "badges"; items: ResultBadge[] }
  | { type: "keyValues"; title?: string; rows: KeyValueRow[] }
  | { type: "json"; title?: string; body: string };

export type ParsedExecutionResult = {
  sections: StructuredResultSection[];
  rawJson: string;
  hasAnswer: boolean;
};

export function parsedResultHasAnswer(sections: StructuredResultSection[]): boolean {
  return sections.some((s) => s.type === "text" && s.title === "Answer" && s.body.trim().length > 0);
}

function formatJson(value: unknown): string {
  if (value === undefined) return "null";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function keyValueEntryKey(record: Record<string, unknown>): string {
  return stringOrEmpty(record.Key ?? record.key);
}

function keyValueEntryValue(record: Record<string, unknown>): unknown {
  return record.Value !== undefined ? record.Value : record.value;
}

function isKeyValueEntry(value: unknown): value is Record<string, unknown> {
  const record = asRecord(value);
  if (!record) return false;
  const key = keyValueEntryKey(record);
  return key.length > 0 && (record.Value !== undefined || record.value !== undefined);
}

/** BSON `D` / legacy encodings store maps as `[{ Key, Value }, ...]` — fold into a plain object. */
export function normalizeExecutionResult(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const kvObject = keyValueArrayToObject(value);
    if (kvObject) return kvObject;
    return value.map((entry) => normalizeExecutionResult(entry));
  }

  const record = asRecord(value);
  if (!record) return value;

  const normalized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    normalized[k] = normalizeExecutionResult(v);
  }
  return normalized;
}

function keyValueArrayToObject(entries: unknown[]): Record<string, unknown> | null {
  if (entries.length === 0) return null;

  const out: Record<string, unknown> = {};
  let kvCount = 0;

  for (const entry of entries) {
    if (!isKeyValueEntry(entry)) continue;
    const key = keyValueEntryKey(entry);
    out[key] = normalizeExecutionResult(keyValueEntryValue(entry));
    kvCount += 1;
  }

  if (kvCount === 0) return null;
  return out;
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function extractOpenAiContent(record: Record<string, unknown>): string {
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = asRecord(choices[0]);
  if (!first) return "";
  const message = asRecord(first.message);
  const content = message?.content ?? first.text ?? record.output_text;
  const text = stringOrEmpty(content);
  if (text) return text;

  const executed = message?.executed_tools ?? first.executed_tools;
  if (Array.isArray(executed)) {
    for (const tool of executed) {
      const t = asRecord(tool);
      const toolContent = t ? stringOrEmpty(t.output ?? t.result ?? t.content) : "";
      if (toolContent) return toolContent;
    }
  }
  return "";
}

function formatLocation(record: Record<string, unknown>): string | undefined {
  const loc = asRecord(record.location);
  if (!loc) return undefined;
  const name = stringOrEmpty(loc.name);
  const lat = loc.lat ?? loc.latitude;
  const lon = loc.lon ?? loc.longitude;
  if (name && lat != null && lon != null) return `${name} (${lat}, ${lon})`;
  if (name) return name;
  if (lat != null && lon != null) return `${lat}, ${lon}`;
  return undefined;
}

function parseForecastRows(forecast: unknown): ForecastRow[] {
  if (!Array.isArray(forecast)) return [];
  const rows: ForecastRow[] = [];
  for (const row of forecast) {
    const r = asRecord(row);
    if (!r) continue;
    rows.push({
      time: stringOrEmpty(r.time) || "—",
      temperature_c: stringOrEmpty(r.temperature_c ?? r.temperature) || undefined,
      wind_kph: stringOrEmpty(r.wind_kph ?? r.wind) || undefined,
      rain_mm: stringOrEmpty(r.rain_mm ?? r.rain) || undefined,
      value: stringOrEmpty(r.value) || undefined,
      variable: stringOrEmpty(r.variable) || undefined,
    });
  }
  return rows;
}

function citationLinks(record: Record<string, unknown>): string[] {
  const raw = record.citations;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (typeof c === "string") return c.trim();
      const obj = asRecord(c);
      if (!obj) return "";
      return stringOrEmpty(obj.url ?? obj.link ?? obj.href);
    })
    .filter((u) => u.length > 0);
}

function authenticityBadges(record: Record<string, unknown>): ResultBadge[] {
  const badges: ResultBadge[] = [];
  if ("isAI" in record) {
    badges.push({
      label: "AI-generated",
      value: record.isAI === true ? "Yes" : record.isAI === false ? "No" : String(record.isAI),
    });
  }
  if ("label" in record && !("isAI" in record)) {
    badges.push({ label: "Label", value: stringOrEmpty(record.label) || "—" });
  }
  const confidence = record.confidence;
  if (confidence !== undefined && confidence !== null && confidence !== "") {
    const n = typeof confidence === "number" ? confidence : Number(confidence);
    badges.push({
      label: "Confidence",
      value: Number.isFinite(n) ? `${(n <= 1 ? n * 100 : n).toFixed(1)}%` : String(confidence),
    });
  }
  return badges;
}

function executedToolRows(record: Record<string, unknown>): KeyValueRow[] {
  const tools = record.executed_tools;
  if (!Array.isArray(tools) || tools.length === 0) return [];
  return tools.map((tool, i) => {
    const t = asRecord(tool);
    const name = t ? stringOrEmpty(t.name ?? t.type) : "";
    const query = t ? stringOrEmpty(t.query ?? t.input) : "";
    const value = [name, query].filter(Boolean).join(" — ") || formatJson(tool);
    return { label: `Tool ${i + 1}`, value };
  });
}

/** One-line summary for feed tooltips and alert cards. */
export function summarizeExecutionResult(result: unknown): string {
  const parsed = parseExecutionResult(result);
  for (const section of parsed.sections) {
    if (section.type === "text" && section.body.trim()) {
      const line = section.body.replace(/\s+/g, " ").trim();
      return line.length > 160 ? `${line.slice(0, 157)}…` : line;
    }
    if (section.type === "badges" && section.items.length > 0) {
      return section.items.map((b) => `${b.label}: ${b.value}`).join(" · ");
    }
    if (section.type === "forecast" && section.rows.length > 0) {
      const first = section.rows[0];
      const loc = section.location ? `${section.location} — ` : "";
      return `${loc}Forecast from ${first.time}${first.temperature_c ? `, ${first.temperature_c}°C` : ""}`;
    }
    if (section.type === "citations" && section.links.length > 0) {
      return `${section.links.length} citation${section.links.length === 1 ? "" : "s"}`;
    }
  }
  if (result === null || result === undefined) return "No subnet result stored.";
  return "Structured subnet response (open details for full breakdown).";
}

/** Structured sections for signal details UI. */
export function parseExecutionResult(result: unknown): ParsedExecutionResult {
  const normalized = normalizeExecutionResult(result);
  const rawJson = formatJson(normalized);

  if (normalized === null || normalized === undefined) {
    const sections = [{ type: "text" as const, title: "Answer", body: "No result returned." }];
    return { sections, rawJson: "null", hasAnswer: false };
  }

  if (typeof normalized === "string") {
    const body = normalized.trim() || "Empty string result.";
    const sections = [{ type: "text" as const, title: "Answer", body }];
    return { sections, rawJson, hasAnswer: body.length > 0 && body !== "Empty string result." };
  }

  if (typeof normalized === "number" || typeof normalized === "boolean") {
    const sections = [{ type: "text" as const, title: "Answer", body: String(normalized) }];
    return { sections, rawJson, hasAnswer: true };
  }

  if (Array.isArray(normalized)) {
    const sections = [{ type: "json" as const, title: "Result", body: rawJson }];
    return { sections, rawJson, hasAnswer: false };
  }

  const record = asRecord(normalized);
  if (!record) {
    const sections = [{ type: "text" as const, title: "Answer", body: String(normalized) }];
    return { sections, rawJson, hasAnswer: true };
  }

  const sections: StructuredResultSection[] = [];
  const consumed = new Set<string>();

  const mark = (...keys: string[]) => {
    for (const k of keys) consumed.add(k);
  };

  const openAi = extractOpenAiContent(record);
  if (openAi) {
    sections.push({ type: "text", title: "Answer", body: openAi });
    mark("choices");
  }

  const answer = stringOrEmpty(record.answer);
  if (answer && !openAi) {
    sections.push({ type: "text", title: "Answer", body: answer });
    mark("answer");
  }

  const topContent = stringOrEmpty(record.content ?? record.generated_text);
  if (topContent && !openAi && !answer) {
    sections.push({ type: "text", title: "Answer", body: topContent });
    mark("content", "generated_text");
  }

  const badges = authenticityBadges(record);
  if (badges.length > 0) {
    sections.push({ type: "badges", items: badges });
    mark("isAI", "label", "confidence");
  }

  const links = citationLinks(record);
  if (links.length > 0) {
    sections.push({ type: "citations", links });
    mark("citations");
  }

  const forecastRows = parseForecastRows(record.forecast);
  if (forecastRows.length > 0) {
    sections.push({
      type: "forecast",
      location: formatLocation(record),
      rows: forecastRows,
    });
    mark("forecast", "location");
  }

  const toolRows = executedToolRows(record);
  if (toolRows.length > 0) {
    sections.push({ type: "keyValues", title: "Executed tools", rows: toolRows });
    mark("executed_tools");
  }

  const reason = stringOrEmpty(record.reason ?? record.reasoning);
  if (reason) {
    sections.push({ type: "text", title: "Reasoning", body: reason });
    mark("reason", "reasoning");
  }

  if (sections.length === 0 && Object.keys(record).length === 0) {
    sections.push({
      type: "text",
      title: "Answer",
      body:
        "The subnet returned an empty object. It may not use OpenAI-style choices or a top-level answer field.",
    });
  }

  const remaining: KeyValueRow[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (consumed.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object") {
      remaining.push({ label: key, value: formatJson(value) });
    } else {
      remaining.push({ label: key, value: stringOrEmpty(value) || String(value) });
    }
  }
  if (remaining.length > 0) {
    sections.push({ type: "keyValues", title: "Additional fields", rows: remaining });
  }

  if (sections.length === 0) {
    sections.push({ type: "json", title: "Result", body: rawJson });
  }

  return { sections, rawJson, hasAnswer: parsedResultHasAnswer(sections) };
}
