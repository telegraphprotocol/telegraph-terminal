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

export type SentenceScoreRow = {
  sentence: string;
  score: number;
};

export type StructuredResultSection =
  | { type: "text"; title?: string; body: string }
  | { type: "citations"; links: string[] }
  | { type: "forecast"; location?: string; rows: ForecastRow[] }
  | { type: "badges"; items: ResultBadge[] }
  | { type: "keyValues"; title?: string; rows: KeyValueRow[] }
  | { type: "sentenceScores"; title?: string; rows: SentenceScoreRow[] }
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

function tryParseJsonString(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function scalarDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed !== null && typeof parsed === "object") {
      return "";
    }
    return value.trim() || "—";
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/** Flatten objects/arrays into key-value rows for display (no raw JSON blocks). */
function flattenToKeyValueRows(labelPrefix: string, value: unknown, depth = 0): KeyValueRow[] {
  if (depth > 5) {
    return [{ label: labelPrefix, value: stringOrEmpty(value) || "…" }];
  }

  if (value === null || value === undefined) {
    return [{ label: labelPrefix, value: "—" }];
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed !== null) {
      return flattenToKeyValueRows(labelPrefix, parsed, depth + 1);
    }
    return [{ label: labelPrefix, value: value.trim() || "—" }];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [{ label: labelPrefix, value: String(value) }];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return [{ label: labelPrefix, value: "(empty list)" }];
    const rows: KeyValueRow[] = [];
    value.forEach((entry, i) => {
      const childLabel = `${labelPrefix}[${i}]`;
      const childRows = flattenToKeyValueRows(childLabel, entry, depth + 1);
      if (childRows.length === 1 && childRows[0].label === childLabel) {
        rows.push(childRows[0]);
      } else {
        rows.push(...childRows);
      }
    });
    return rows;
  }

  const record = asRecord(value);
  if (!record) {
    return [{ label: labelPrefix, value: String(value) }];
  }

  const keys = Object.keys(record);
  if (keys.length === 0) return [{ label: labelPrefix, value: "(empty object)" }];

  const rows: KeyValueRow[] = [];
  for (const key of keys) {
    const childLabel = labelPrefix ? `${labelPrefix}.${key}` : key;
    const child = record[key];
    if (child !== null && typeof child === "object") {
      rows.push(...flattenToKeyValueRows(childLabel, child, depth + 1));
    } else {
      const scalar = scalarDisplay(child);
      if (scalar === "" && typeof child === "string") {
        rows.push(...flattenToKeyValueRows(childLabel, child, depth + 1));
      } else {
        rows.push({ label: childLabel, value: scalar || stringOrEmpty(child) || "—" });
      }
    }
  }
  return rows;
}

function valueToKeyValueRows(label: string, value: unknown): KeyValueRow[] {
  return flattenToKeyValueRows(label, value, 0);
}

/** OpenAI /responses API: output_text or output[0].content[0].text */
function extractResponsesApiContent(record: Record<string, unknown>): string {
  const outputText = stringOrEmpty(record.output_text);
  if (outputText) return outputText;

  const output = record.output;
  if (!Array.isArray(output)) return "";

  for (const item of output) {
    const entry = asRecord(item);
    if (!entry) continue;

    const entryType = stringOrEmpty(entry.type);
    if (entryType && entryType !== "message") continue;

    const parts = entry.content;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const block = asRecord(part);
        if (!block) continue;
        const text = stringOrEmpty(block.text ?? block.output_text);
        if (text) return text;
      }
    }

    const direct = stringOrEmpty(entry.text);
    if (direct) return direct;
  }

  return "";
}

function extractOpenAiContent(record: Record<string, unknown>): string {
  const responses = extractResponsesApiContent(record);
  if (responses) return responses;

  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = asRecord(choices[0]);
  if (!first) return "";
  const message = asRecord(first.message);
  const content = message?.content ?? first.text;
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

/** Sapling AI detector: { score, sentence_scores, text, tokens, token_probs } */
function parseSaplingResult(
  record: Record<string, unknown>,
): { badges: ResultBadge[]; sentenceRows: SentenceScoreRow[] } | null {
  const score = record.score;
  const sentenceScores = record.sentence_scores;
  if (typeof score !== "number" || !Array.isArray(sentenceScores)) return null;

  const pct = (score * 100).toFixed(2);
  const verdict = score >= 0.8 ? "AI-generated" : score >= 0.5 ? "Uncertain" : "Human-written";
  const badges: ResultBadge[] = [
    { label: "Verdict", value: verdict },
    { label: "AI Probability", value: `${pct}%` },
  ];

  const sentenceRows: SentenceScoreRow[] = sentenceScores
    .map((row) => {
      const r = asRecord(row);
      if (!r) return null;
      const s = stringOrEmpty(r.sentence);
      const sc = typeof r.score === "number" ? r.score : Number(r.score);
      return s ? { sentence: s, score: Number.isFinite(sc) ? sc : 0 } : null;
    })
    .filter((r): r is SentenceScoreRow => r !== null);

  return { badges, sentenceRows };
}

/** ItsAI detector: { answer: 0|1, status, segmentation_tokens } */
function parseItsAiResult(record: Record<string, unknown>): ResultBadge[] | null {
  const answer = record.answer;
  const status = record.status;
  if ((answer !== 0 && answer !== 1 && answer !== 0.0 && answer !== 1.0) || typeof status !== "string") return null;
  const isAi = answer === 1 || answer === 1.0;
  return [
    { label: "Verdict", value: isAi ? "AI-generated" : "Human-written" },
    { label: "Status", value: String(status) },
  ];
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
    if (section.type === "sentenceScores" && section.rows.length > 0) {
      return `${section.rows.length} sentence${section.rows.length === 1 ? "" : "s"} analyzed`;
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
    const rows = flattenToKeyValueRows("item", normalized, 0);
    const sections: StructuredResultSection[] =
      rows.length > 0
        ? [{ type: "keyValues", title: "Result", rows }]
        : [{ type: "text", title: "Answer", body: "Empty array result." }];
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

  // Sapling AI detector
  const sapling = parseSaplingResult(record);
  if (sapling) {
    sections.push({ type: "badges", items: sapling.badges });
    if (sapling.sentenceRows.length > 0) {
      sections.push({ type: "sentenceScores", title: "Per-sentence breakdown", rows: sapling.sentenceRows });
    }
    mark("score", "sentence_scores", "text", "token_probs", "tokens");
  }

  // ItsAI detector
  const itsAi = !sapling ? parseItsAiResult(record) : null;
  if (itsAi) {
    sections.push({ type: "badges", items: itsAi });
    mark("answer", "status", "segmentation_tokens");
  }

  const openAi = extractOpenAiContent(record);
  if (openAi) {
    sections.push({ type: "text", title: "Answer", body: openAi });
    mark("choices", "output", "output_text");
  }

  const answer = stringOrEmpty(record.answer);
  if (answer && !openAi && !itsAi) {
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
    remaining.push(...valueToKeyValueRows(key, value));
  }
  if (remaining.length > 0) {
    sections.push({ type: "keyValues", title: "Additional fields", rows: remaining });
  }

  if (sections.length === 0) {
    const rows = valueToKeyValueRows("result", normalized);
    if (rows.length > 0) {
      sections.push({ type: "keyValues", title: "Result", rows });
    } else {
      sections.push({
        type: "text",
        title: "Answer",
        body: "Structured result available — use Copy JSON for the raw payload.",
      });
    }
  }

  return { sections, rawJson, hasAnswer: parsedResultHasAnswer(sections) };
}
