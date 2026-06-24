"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSignTypedData, useAccount } from "wagmi";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, clusterApiUrl } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { usePaymentNetwork } from "@/lib/network-context";
import {
  ChatMessage,
  StoredReceipt,
  TerminalLogEntry,
  type ConversationGroup,
  type MessageSendState,
} from "@/lib/mock-data";
import { useEngineWS } from "@/lib/hooks/use-engine-ws";
import { EngineAskResult, EngineWsFrame } from "@/lib/engine-daemon-types";
import type { SubnetPickItem } from "@/lib/subnet-catalog";
import {
  computePaidDirectBody,
  fetchSubnetYamlBySlug,
  getDefaultDirectModelForSpec,
  pickDefaultEndpoint,
  type ParsedSubnetYaml,
  type PaidDirectCallBody,
} from "@/lib/subnet-direct-spec";
import { useTerminalPlayback } from "@/lib/hooks/use-terminal-playback";
import {
  buildErrorScript,
  buildPostResponseScript,
  buildPreflightScript,
  scriptEntriesFromDisplayedLogs,
  type TerminalScriptContext,
} from "@/lib/build-terminal-script";
import { authHeaders } from "@/lib/auth";

const LS_KEY = "telegraph-live-chat-sessions-v1";
const LS_VERSION = 2 as const;

const USE_TERMINAL_BACKEND_PAID_CHAT =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402 === "true";

const WALLET_RETRY_ATTEMPTS = 3;
const WALLET_RETRY_DELAY_MS = 450;

export type BackendWalletStatus = "idle" | "checking" | "ready" | "unavailable";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const X402_CHAT_MODEL =
  process.env.NEXT_PUBLIC_X402_CHAT_MODEL?.trim() || "gpt-4o-mini";

export type LiveTerminalReceipt = {
  subnet: string;
  subnetId: string;
  costUsd: number;
  durationMs: number;
  timestamp: string;
  intent?: string;
  reasoning?: string;
  /** Raw engine `result` for technical JSON foldout (null if absent). */
  technicalDetails?: unknown | null;
  /** Browser x402 settlement (EVM) */
  x402TxHash?: string;
  x402ExplorerUrl?: string;
  x402Network?: string;
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
  archived?: boolean;
};

function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.content[0]?.text?.trim();
  if (!text) return "New chat";
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

function toTimeLabel(timestamp?: string) {
  if (!timestamp) return new Date().toLocaleTimeString();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString();
}

function toLog(frame: EngineWsFrame): TerminalLogEntry {
  const data = frame.data ?? {};
  const label = frame.type.toUpperCase();

  if (frame.type === "routed") {
    const subnetName = String(data.subnet_name ?? "unknown");
    const subnetId = String(data.subnet_id ?? "n/a");
    const intent = data.intent ? `, intent: ${String(data.intent)}` : "";
    return {
      time: toTimeLabel(frame.timestamp),
      label,
      detail: `Routed to ${subnetName} (SN${subnetId})${intent}`,
      section: "Initial Routing",
    };
  }

  if (frame.type === "error") {
    return {
      time: toTimeLabel(frame.timestamp),
      label,
      detail: String(data.message ?? "Engine execution failed"),
      section: "Execution",
    };
  }

  const statusMessage = data.status ?? data.message ?? data.query ?? "Processing request";

  return {
    time: toTimeLabel(frame.timestamp),
    label,
    detail: String(statusMessage),
    section:
      frame.type === "executing" || frame.type === "result" ? "Execution" : "Initial Routing",
  };
}

function formatWeatherResult(record: Record<string, unknown>): string | null {
  const hourly = record.hourly as Record<string, unknown> | undefined;
  if (!hourly) return null;
  const temps = hourly["2t"] as number[] | undefined;
  const times = hourly["time"] as string[] | undefined;
  if (!Array.isArray(temps) || !Array.isArray(times) || temps.length === 0) return null;

  const toC = (k: number) => +(k - 273.15).toFixed(1);
  const toF = (c: number) => +(c * 9 / 5 + 32).toFixed(1);

  const lat = typeof record.latitude === "number" ? record.latitude : null;
  const lon = typeof record.longitude === "number" ? record.longitude : null;
  const model = typeof record.model === "string" ? record.model.toUpperCase() : "Unknown";
  const ingestedAt = typeof record.ingested_at === "string" ? record.ingested_at : null;

  const latStr = lat !== null ? `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}` : "";
  const lonStr = lon !== null ? `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}` : "";
  const locationStr = latStr && lonStr ? `${latStr}, ${lonStr}` : "";

  const updatedStr = ingestedAt
    ? new Date(ingestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false }) + " UTC"
    : "";

  const celsiusTemps = temps.map(toC);
  const maxC = Math.max(...celsiusTemps);
  const minC = Math.min(...celsiusTemps);
  const maxIdx = celsiusTemps.indexOf(maxC);
  const minIdx = celsiusTemps.indexOf(minC);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const headerParts = [`**Weather Forecast**`];
  if (locationStr) headerParts.push(locationStr);
  const subParts: string[] = [];
  if (model) subParts.push(`Model: ${model}`);
  if (updatedStr) subParts.push(`Updated ${updatedStr}`);

  const codeLines: string[] = [];
  let lastDate = "";
  for (let i = 0; i < times.length; i++) {
    const iso = times[i];
    const date = fmtDate(iso);
    if (date !== lastDate) {
      if (lastDate !== "") codeLines.push("");
      codeLines.push(`── ${date} ──`);
      lastDate = date;
    }
    const c = celsiusTemps[i];
    const f = toF(c);
    const barLen = Math.max(1, Math.round(((c - minC) / Math.max(maxC - minC, 1)) * 10));
    const bar = "█".repeat(barLen).padEnd(10);
    codeLines.push(`${fmtTime(iso)}  ${bar}  ${c > 0 ? "+" : ""}${c}°C  (${f}°F)`);
  }

  const provenance = record.hourly_provenance as Record<string, unknown> | undefined;
  const source = provenance?.["2t"] as string | undefined;

  const out: string[] = [
    headerParts.join(" — "),
    subParts.join(" · "),
    "",
    `**Today's Range:** ${minC}°C (${toF(minC)}°F) → ${maxC}°C (${toF(maxC)}°F)`,
    `**Peak:** ${maxC}°C at ${fmtTime(times[maxIdx])} UTC  ·  **Low:** ${minC}°C at ${fmtTime(times[minIdx])} UTC`,
    "",
    "**Hourly Breakdown:**",
    "```",
    ...codeLines,
    "```",
  ];

  if (source) {
    out.push("", `_Source: ${source}_`);
  }

  return out.join("\n");
}

function extractAssistantText(result: unknown): string {
  if (!result) return "No result returned.";
  if (typeof result === "string") return result;
  if (typeof result === "number" || typeof result === "boolean") return String(result);
  if (Array.isArray(result)) return JSON.stringify(result, null, 2);
  if (typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (Object.keys(record).length === 0) {
      return "The chat API returned an empty `{}` object (no assistant text). The subnet may not return OpenAI-style `choices[0].message.content` for this route.";
    }
    const choices = record.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown>;
      const message = first.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (typeof content === "string" && content.trim().length > 0) return content;
    }
    const answer = record.answer;
    if (typeof answer === "string" && answer.trim().length > 0) return answer;
    if (record.forecast && Array.isArray(record.forecast)) {
      const forecast = record.forecast as Array<Record<string, unknown>>;
      const first = forecast[0];
      if (first) {
        return `Forecast for requested location starts at ${String(first.time ?? "n/a")} with ${String(first.temperature_c ?? "n/a")}°C and rain ${String(first.rain_mm ?? "n/a")}mm.`;
      }
    }
    const weatherFormatted = formatWeatherResult(record);
    if (weatherFormatted) return weatherFormatted;
    return JSON.stringify(result, null, 2);
  }
  return "Unsupported result format.";
}

/** Technical line for TERMINAL logs (not necessarily user-facing). */
function formatErrorForLog(err: unknown): string {
  if (err instanceof Error) {
    let cause = "";
    if (err.cause instanceof Error) {
      cause = ` | cause: ${err.cause.name}: ${err.cause.message}`;
    } else if (err.cause != null) {
      cause = ` | cause: ${String(err.cause)}`;
    }
    return `${err.name}: ${err.message}${cause}`;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err).slice(0, 800);
  } catch {
    return String(err);
  }
}

function describeHttpError(status: number, statusText: string, bodyText: string): string {
  const st = statusText?.trim() ? ` ${statusText.trim()}` : "";
  const trimmed = bodyText.trim();
  let bodyPart = "";
  if (trimmed) {
    const max = 800;
    const slice = trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
    bodyPart = ` Body: ${slice}`;
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      for (const k of ["message", "error", "detail", "reason", "description"]) {
        const v = j[k];
        if (typeof v === "string" && v.trim()) {
          bodyPart += ` | ${k}: ${v.trim().slice(0, 300)}`;
          break;
        }
      }
      if (Object.keys(j).length === 0) {
        bodyPart += " (parsed as empty JSON object)";
      }
    } catch {
      /* not JSON */
    }
  } else {
    bodyPart = " (empty response body)";
  }
  if (status === 402) {
    return `x402: still HTTP 402 after sign/retry${st}.${bodyPart} The resource or facilitator may have rejected the payment header, amount, or rail.`;
  }
  return `Telegraph chat failed: HTTP ${status}${st}.${bodyPart}`;
}

function emptySession(id?: string): ChatSession {
  const sid = id ?? crypto.randomUUID();
  return {
    id: sid,
    title: "New chat",
    messages: [],
    updatedAt: Date.now(),
  };
}

function chatMessagesToOpenAi(
  msgs: ChatMessage[],
): { role: "user" | "assistant" | "system"; content: string }[] {
  const out: { role: "user" | "assistant" | "system"; content: string }[] = [];
  for (const m of msgs) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (m.role === "user" && m.sendState === "failed") continue;
    const text = m.content
      .filter((c) => c.kind === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();
    if (!text) continue;
    out.push({ role: m.role, content: text });
  }
  return out;
}

export function useLiveExecutor(opts?: {
  forcedSubnetId?: string | null;
  engineSubnets?: SubnetPickItem[];
}) {
  const forcedSubnetId = opts?.forcedSubnetId ?? null;
  const engineSubnets = opts?.engineSubnets ?? [];

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const terminalPlayback = useTerminalPlayback<LiveTerminalReceipt>();
  const displayedLogsRef = useRef<TerminalLogEntry[]>([]);
  const [subnetYamlSpec, setSubnetYamlSpec] = useState<ParsedSubnetYaml | null>(null);
  const [subnetSpecLoading, setSubnetSpecLoading] = useState(false);
  const [subnetSpecError, setSubnetSpecError] = useState<string | null>(null);
  const [directEndpointPath, setDirectEndpointPath] = useState<string | null>(null);
  const [directModel, setDirectModel] = useState(X402_CHAT_MODEL);
  const [directImageUrl, setDirectImageUrl] = useState("");
  const [directLat, setDirectLat] = useState("");
  const [directLon, setDirectLon] = useState("");
  const [directGateError, setDirectGateError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [x402Phase, setX402Phase] = useState<null | "paying" | "settled">(null);
  /** Bump whenever paid subnet / endpoint changes so we re-apply YAML default_model. */
  const directModelContextKeyRef = useRef<string | null>(null);
  const { isConnected: engineSocketConnected, lastError, sendMessage, subscribe } = useEngineWS();
  const { address: connectedAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { publicKey: solanaPubkey, signTransaction: signSolanaTransaction } = useWallet();
  const { network: selectedNetwork } = usePaymentNetwork();

  type CoreWalletPayload = {
    address: string;
    chainId: number;
    nativeBalanceFormatted: string;
    usdcBalance?: string;
  };

  const [coreWallet, setCoreWallet] = useState<CoreWalletPayload | null>(null);
  const [coreWalletError, setCoreWalletError] = useState<string | null>(null);
  const [backendWalletStatus, setBackendWalletStatus] = useState<BackendWalletStatus>(
    USE_TERMINAL_BACKEND_PAID_CHAT ? "checking" : "idle",
  );

  /** Free-trial subnet quota for anonymous visitors. */
  const [anonUsage, setAnonUsage] = useState<{ remaining: number; limit: number } | null>(null);
  /** Daily free AI chat quota. */
  const [anonAiUsage, setAnonAiUsage] = useState<{ remaining: number; limit: number } | null>(null);

  // Selected-message receipt — set when user clicks "Receipt" on a past message
  const [selectedMsgReceipt, setSelectedMsgReceipt] = useState<LiveTerminalReceipt | null>(null);
  const [selectedMsgLogs, setSelectedMsgLogs] = useState<TerminalLogEntry[]>([]);

  const refreshAnonUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/anon/usage", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { remaining?: number; limit?: number };
      if (typeof data.remaining === "number" && typeof data.limit === "number") {
        setAnonUsage({ remaining: data.remaining, limit: data.limit });
      }
    } catch {
      // Best-effort — the in-band anonUsage on each chat response is the
      // source of truth once the user has sent at least one message.
    }
  }, []);

  useEffect(() => {
    void refreshAnonUsage();
  }, [refreshAnonUsage]);

  const fetchCoreWallet = useCallback(async () => {
    if (!USE_TERMINAL_BACKEND_PAID_CHAT) return;
    setBackendWalletStatus("checking");
    let lastError: string | null = null;
    for (let attempt = 0; attempt < WALLET_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(WALLET_RETRY_DELAY_MS);
      }
      try {
        const res = await fetch(`/api/core/wallet?network=${selectedNetwork}`, { cache: "no-store", headers: authHeaders() });
        const text = await res.text();
        if (!res.ok) {
          lastError = text.slice(0, 400) || `HTTP ${res.status}`;
          setCoreWallet(null);
          continue;
        }
        setCoreWallet(JSON.parse(text) as CoreWalletPayload);
        setCoreWalletError(null);
        setBackendWalletStatus("ready");
        return;
      } catch (e) {
        lastError =
          e instanceof Error ? e.message : "Could not reach Terminal Backend (wallet).";
        setCoreWallet(null);
      }
    }
    setCoreWalletError(lastError);
    setBackendWalletStatus("unavailable");
  }, [selectedNetwork]);

  useEffect(() => {
    void fetchCoreWallet();
  }, [fetchCoreWallet]);

  const {
    displayedLogs: terminalLogs,
    displayedReceipt: terminalReceipt,
    isRevealing: terminalIsRevealing,
    reset: resetTerminalPlayback,
    playScript: playTerminalScript,
    appendThrottled: appendTerminalLogThrottled,
    queueReceiptAfterThrottle,
  } = terminalPlayback;

  useEffect(() => {
    displayedLogsRef.current = terminalLogs;
  }, [terminalLogs]);

  const scriptContext = useMemo((): TerminalScriptContext => {
    return {
      forcedSubnetId,
      engineSubnets,
      coreWallet: coreWallet
        ? {
            address: coreWallet.address,
            usdcBalance: coreWallet.usdcBalance,
            chainId: coreWallet.chainId,
          }
        : null,
      useTerminalBackend: USE_TERMINAL_BACKEND_PAID_CHAT,
      network: selectedNetwork,
    };
  }, [forcedSubnetId, engineSubnets, coreWallet, selectedNetwork]);

  const startTerminalPreflight = useCallback(() => {
    resetTerminalPlayback();
    playTerminalScript(buildPreflightScript(scriptContext));
  }, [resetTerminalPlayback, playTerminalScript, scriptContext]);

  const coreReady =
    USE_TERMINAL_BACKEND_PAID_CHAT && backendWalletStatus === "ready";

  const isConnected = USE_TERMINAL_BACKEND_PAID_CHAT ? coreReady : engineSocketConnected;

  const activeSessionIdRef = useRef<string | null>(null);
  /** Latest `sessions` for async callbacks (e.g. queued microtasks) — avoids stale closures. */
  const sessionsRef = useRef<ChatSession[]>([]);
  const forcedSubnetIdRef = useRef<string | null>(forcedSubnetId);
  /** Stable object so `.current` is never reassigned; satisfies react-hooks/immutability. */
  const activeQueryCell = useRef<{ value: string | null }>({ value: null });

  useEffect(() => {
    forcedSubnetIdRef.current = forcedSubnetId;
  }, [forcedSubnetId]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    setDirectImageUrl("");
    setDirectLat("");
    setDirectLon("");
    setDirectGateError(null);
    directModelContextKeyRef.current = null;
  }, [forcedSubnetId]);

  useEffect(() => {
    if (!USE_TERMINAL_BACKEND_PAID_CHAT || !forcedSubnetId || !subnetYamlSpec || !directEndpointPath) {
      return;
    }
    if (subnetYamlSpec.id !== forcedSubnetId) {
      return;
    }
    const key = `${subnetYamlSpec.id}:${directEndpointPath}`;
    if (directModelContextKeyRef.current === key) return;
    const def = getDefaultDirectModelForSpec(subnetYamlSpec, directEndpointPath);
    setDirectModel(def ?? X402_CHAT_MODEL);
    directModelContextKeyRef.current = key;
  }, [forcedSubnetId, subnetYamlSpec, directEndpointPath]);

  useEffect(() => {
    if (!USE_TERMINAL_BACKEND_PAID_CHAT || !forcedSubnetId) {
      setSubnetYamlSpec(null);
      setSubnetSpecLoading(false);
      setSubnetSpecError(null);
      setDirectEndpointPath(null);
      return;
    }

    const slug = opts?.engineSubnets?.find((s) => s.id === forcedSubnetId)?.slug;
    if (!slug) {
      setSubnetYamlSpec(null);
      setSubnetSpecLoading(false);
      setSubnetSpecError(
        "Subnet slug missing from engine /v1/subnets — cannot load YAML spec.",
      );
      return;
    }

    let cancelled = false;
    setSubnetSpecLoading(true);
    setSubnetSpecError(null);

    void fetchSubnetYamlBySlug(slug).then((spec) => {
      if (cancelled) return;
      setSubnetSpecLoading(false);
      if (!spec) {
        setSubnetYamlSpec(null);
        setSubnetSpecError(null);
        return;
      }
      setSubnetYamlSpec(spec);
      const d = pickDefaultEndpoint(spec);
      setDirectEndpointPath(d?.path ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [forcedSubnetId, opts?.engineSubnets]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          version?: number;
          sessions?: ChatSession[];
          activeSessionId?: string;
        };
        if (
          (parsed.version === 1 || parsed.version === LS_VERSION) &&
          Array.isArray(parsed.sessions)
        ) {
          const normalized: ChatSession[] = parsed.sessions.map((s) => ({
            ...s,
            messages: Array.isArray(s.messages) ? s.messages : [],
            archived: Boolean((s as ChatSession).archived),
          }));
          queueMicrotask(() => {
            let rows = normalized;
            let aid = parsed.activeSessionId;
            if (!aid || !rows.some((s) => s.id === aid)) {
              const row = emptySession();
              aid = row.id;
              rows = [row, ...rows];
            }
            setSessions(rows);
            setActiveSessionId(aid);
            activeSessionIdRef.current = aid;
            setHydrated(true);
          });
          return;
        }
      }
    } catch {
      /* fall through */
    }
    queueMicrotask(() => {
      const row = emptySession();
      setSessions([row]);
      setActiveSessionId(row.id);
      activeSessionIdRef.current = row.id;
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          version: LS_VERSION,
          sessions,
          activeSessionId,
        }),
      );
    } catch {
      /* ignore quota */
    }
  }, [sessions, activeSessionId, hydrated]);

  /** Active id missing from sessions (e.g. deleted): pick another or create an empty chat. */
  useEffect(() => {
    if (!hydrated || !activeSessionId) return;
    const cur = sessions.find((s) => s.id === activeSessionId);
    if (cur) return;

    queueMicrotask(() => {
      const sid = activeSessionIdRef.current;
      const latest = sessionsRef.current;
      if (!sid) return;
      if (latest.some((s) => s.id === sid)) return;

      const visibleNow = latest.filter((s) => !s.archived);
      if (visibleNow.length === 0) {
        const row = emptySession();
        activeSessionIdRef.current = row.id;
        setSessions((prev) => [row, ...prev]);
        setActiveSessionId(row.id);
      } else {
        const pick = [...visibleNow].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        activeSessionIdRef.current = pick.id;
        setActiveSessionId(pick.id);
      }
      resetTerminalPlayback();
      setIsLoading(false);
      setX402Phase(null);
      setRuntimeError(null);
      activeQueryCell.current.value = null;
    });
  }, [sessions, activeSessionId, hydrated, resetTerminalPlayback]);

  const clearTerminalSession = useCallback(() => {
    resetTerminalPlayback();
    setIsLoading(false);
    setX402Phase(null);
    setRuntimeError(null);
    activeQueryCell.current.value = null;
  }, [resetTerminalPlayback]);

  const archiveSession = useCallback((id: string) => {
    let switchTo: string | null = null;
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, archived: true } : s,
      );
      if (activeSessionIdRef.current !== id) return next;
      const visible = next.filter((s) => !s.archived);
      if (visible.length === 0) {
        const row = emptySession();
        switchTo = row.id;
        return [row, ...next];
      }
      switchTo = [...visible].sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
      return next;
    });
    if (switchTo !== null) {
      activeSessionIdRef.current = switchTo;
      setActiveSessionId(switchTo);
      clearTerminalSession();
    }
  }, [clearTerminalSession]);

  const restoreSession = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, archived: false } : s)),
    );
  }, []);

  const deleteSession = useCallback((id: string) => {
    let newActiveId: string | undefined;
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const row = emptySession();
        newActiveId = row.id;
        return [row];
      }
      if (activeSessionIdRef.current === id) {
        const pool = next.some((s) => !s.archived)
          ? next.filter((s) => !s.archived)
          : next;
        const pick = [...pool].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        newActiveId = pick.id;
      }
      return next;
    });
    if (newActiveId !== undefined) {
      activeSessionIdRef.current = newActiveId;
      setActiveSessionId(newActiveId);
      clearTerminalSession();
    }
  }, [clearTerminalSession]);

  const messages = useMemo(() => {
    if (!activeSessionId) return [];
    return sessions.find((s) => s.id === activeSessionId)?.messages ?? [];
  }, [sessions, activeSessionId]);

  const appendToSessionMessages = useCallback(
    (sid: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      if (!sid) return;
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === sid);
        if (idx === -1) {
          const nextMsgs = updater([]);
          if (nextMsgs.length === 0) return prev;
          const row: ChatSession = {
            id: sid,
            title: deriveTitle(nextMsgs),
            messages: nextMsgs,
            updatedAt: Date.now(),
          };
          return [row, ...prev];
        }
        return prev.map((s, i) => {
          if (i !== idx) return s;
          const nextMsgs = updater(s.messages);
          return {
            ...s,
            messages: nextMsgs,
            title: deriveTitle(nextMsgs),
            updatedAt: Date.now(),
          };
        });
      });
    },
    [],
  );

  const appendToActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const sid = activeSessionIdRef.current;
      if (!sid) return;
      appendToSessionMessages(sid, updater);
    },
    [appendToSessionMessages],
  );

  const markUserMessageDelivery = useCallback(
    (
      sessionId: string,
      messageId: string,
      patch: { sendState: MessageSendState; sendError?: string | undefined },
    ) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const messages = s.messages.map((m) =>
            m.id === messageId && m.role === "user" ? { ...m, ...patch } : m,
          );
          return {
            ...s,
            messages,
            title: deriveTitle(messages),
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [],
  );

  useEffect(() => {
    return subscribe((frame) => {
      if (!activeQueryCell.current.value) return;

      if (frame.type === "pong") return;

      {
        const { label, detail, section } = toLog(frame);
        appendTerminalLogThrottled({ label, detail, section });
      }

      if (frame.type === "routed" && frame.data?.reasoning) {
        appendTerminalLogThrottled({
          label: "REASONING",
          detail: String(frame.data?.reasoning),
          section: "Initial Routing",
        });
      }

      if (frame.type === "error") {
        const errText = String(frame.data?.message ?? "Engine execution failed");
        setRuntimeError(errText);
        const sid = activeSessionIdRef.current;
        if (sid) {
          const msgs = sessionsRef.current.find((s) => s.id === sid)?.messages ?? [];
          const lastUser = [...msgs].reverse().find((m) => m.role === "user");
          if (lastUser) {
            markUserMessageDelivery(sid, lastUser.id, {
              sendState: "failed",
              sendError: errText,
            });
          }
        }
        setIsLoading(false);
        activeQueryCell.current.value = null;
      }

      if (frame.type === "result" && frame.data) {
        const resultData = frame.data as unknown as EngineAskResult;
        const assistantText = extractAssistantText(resultData.result);

        const deliverAssistant = () => {
          const engineReceipt: StoredReceipt = {
            subnet: String(resultData.subnet_name ?? "Unknown"),
            subnetId: String(resultData.subnet_used ?? resultData.subnet_id ?? "n/a"),
            costUsd: typeof resultData.cost_usd === "number" ? resultData.cost_usd : 0,
            durationMs: typeof resultData.duration_ms === "number" ? resultData.duration_ms : 0,
            timestamp: typeof resultData.timestamp === "string" && resultData.timestamp ? resultData.timestamp : new Date().toISOString(),
            intent: typeof resultData.intent === "string" ? resultData.intent : undefined,
            reasoning: typeof resultData.reasoning === "string" ? resultData.reasoning : undefined,
          };
          const captureLogs = displayedLogsRef.current.slice(-30);
          appendToActiveMessages((prev) => {
            let lastUserIdx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].role === "user") {
                lastUserIdx = i;
                break;
              }
            }
            const withOkUser =
              lastUserIdx === -1
                ? prev
                : prev.map((m, i) =>
                    i === lastUserIdx && m.role === "user"
                      ? { ...m, sendState: "ok" as const, sendError: undefined }
                      : m,
                  );
            return [
              ...withOkUser,
              {
                id: `live-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                role: "assistant" as const,
                content: [{ kind: "text" as const, text: assistantText }],
                receipt: engineReceipt,
                terminalLogs: captureLogs,
              },
            ];
          });
          setIsLoading(false);
          activeQueryCell.current.value = null;
        };

        queueReceiptAfterThrottle(
          {
            subnet: resultData.subnet_name,
            subnetId: String(resultData.subnet_used ?? resultData.subnet_id ?? "n/a"),
            costUsd: resultData.cost_usd ?? 0,
            durationMs: resultData.duration_ms ?? 0,
            timestamp: resultData.timestamp,
            intent: resultData.intent,
            reasoning: resultData.reasoning,
            technicalDetails: resultData.result ?? null,
          },
          undefined,
          deliverAssistant,
        );
      }
    });
  }, [
    subscribe,
    appendToActiveMessages,
    markUserMessageDelivery,
    appendTerminalLogThrottled,
    queueReceiptAfterThrottle,
  ]);

  const executeCorePaidChat = useCallback(
    async (
      sessionId: string,
      userMessageId: string,
      openAiMessages: { role: "user" | "assistant" | "system"; content: string }[],
      paidDirect?: PaidDirectCallBody | null,
    ) => {
      const fail = (err: unknown, serverLogs?: { label: string; detail: string; section: string }[]) => {
        const msg = err instanceof Error ? err.message : String(err);
        const already = scriptEntriesFromDisplayedLogs(displayedLogsRef.current);
        const errScript = buildErrorScript(
          serverLogs ?? [],
          formatErrorForLog(err),
          scriptContext,
          already,
        );
        playTerminalScript(errScript, undefined, { mode: "append" });
        markUserMessageDelivery(sessionId, userMessageId, {
          sendState: "failed",
          sendError: msg,
        });
        setRuntimeError(msg);
        setX402Phase(null);
      };

      setX402Phase("paying");
      try {
        const res = await fetch("/api/core/chat/paid", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
          body: JSON.stringify({
            model: X402_CHAT_MODEL,
            messages: openAiMessages,
            network: selectedNetwork,
            ...(paidDirect
              ? {
                  subnetId: paidDirect.subnetId,
                  direct: paidDirect.direct,
                }
              : {}),
          }),
        });
        const rawText = await res.text();
        let data: unknown;
        try {
          data = JSON.parse(rawText) as unknown;
        } catch {
          fail(new Error(`Terminal Backend returned non-JSON (HTTP ${res.status})`));
          return;
        }

        const rec = data as Record<string, unknown>;
        const serverLogs = Array.isArray(rec.terminalLogs)
          ? (rec.terminalLogs as { label: string; detail: string; section: string }[])
          : [];

        if (!res.ok) {
          if (res.status === 403 && rec.error === "free_quota_exhausted") {
            const limit = typeof rec.limit === "number" ? rec.limit : anonUsage?.limit ?? 5;
            setAnonUsage({ remaining: 0, limit });
            const msg =
              typeof rec.message === "string"
                ? rec.message
                : "Free message quota used up — connect a wallet to continue.";
            fail(new Error(msg), serverLogs);
            return;
          }
          if (res.status === 403 && rec.error === "free_ai_quota_exhausted") {
            const limit = typeof rec.limit === "number" ? rec.limit : anonAiUsage?.limit ?? 20;
            setAnonAiUsage({ remaining: 0, limit });
            const msg =
              typeof rec.message === "string"
                ? rec.message
                : "Daily free AI chat limit reached — try again tomorrow.";
            fail(new Error(msg), serverLogs);
            return;
          }
          if (res.status === 502 && selectedNetwork === "solana") {
            fail(new Error("Payment failed — check the funds on your Privy Solana Wallet."), serverLogs);
            return;
          }
          const errMsg =
            typeof rec.error === "string"
              ? rec.error
              : describeHttpError(res.status, res.statusText, rawText);
          fail(new Error(errMsg), serverLogs);
          return;
        }

        // 2-phase external wallet payment
        if (rec.status === "payment_required") {
          const payReqsRaw = rec.paymentRequirements;
          const payReqs = (
            typeof payReqsRaw === "string" ? JSON.parse(payReqsRaw) : payReqsRaw
          ) as {
            x402Version: number;
            accepts: {
              scheme: string;
              network: string;
              asset: string;
              payTo: string;
              maxAmountRequired: string;
              maxTimeoutSeconds: number;
              extra?: { name?: string; version?: string };
            }[];
          } | undefined;
          const paySessId = rec.sessionId as string | undefined;

          if (!payReqs?.accepts?.[0] || !paySessId) {
            fail(new Error("Invalid payment_required response from backend"));
            return;
          }

          appendTerminalLogThrottled({
            label: "PAYMENT",
            detail: "Requesting wallet signature for x402 payment…",
            section: "Payment",
          });

          // Pick the accept entry matching the selected network, falling back to first
          const solanaReq = payReqs.accepts.find((a) => a.network?.startsWith("solana:"));
          const evmReq = payReqs.accepts.find((a) => a.network?.startsWith("eip155:") || a.network?.includes("base") || a.network?.includes("sepolia"));
          const useSolana = selectedNetwork === "solana" && Boolean(solanaReq);
          const req = useSolana ? solanaReq! : (evmReq ?? payReqs.accepts[0]);

          let signedPayment: string;

          if (useSolana) {
            // ── Solana signing path ──────────────────────────────────────────
            if (!solanaPubkey || !signSolanaTransaction) {
              fail(new Error("No Solana wallet connected — connect Phantom or Solflare to pay on Solana"), serverLogs);
              return;
            }
            try {
              const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
              const mint = new PublicKey(req.asset);
              const payTo = new PublicKey(req.payTo);
              const senderAta = getAssociatedTokenAddressSync(mint, solanaPubkey);

              const tx = new Transaction();
              tx.add(
                createTransferInstruction(
                  senderAta,
                  payTo,
                  solanaPubkey,
                  BigInt(req.maxAmountRequired),
                ),
              );
              const { blockhash } = await connection.getLatestBlockhash("confirmed");
              tx.recentBlockhash = blockhash;
              tx.feePayer = solanaPubkey;

              const signedTx = await signSolanaTransaction(tx);
              const serialized = signedTx.serialize({ requireAllSignatures: false });
              const txBase64 = Buffer.from(serialized).toString("base64");

              const paymentPayload = {
                x402Version: payReqs.x402Version,
                scheme: req.scheme,
                network: req.network,
                payload: { transaction: txBase64 },
              };
              signedPayment = btoa(JSON.stringify(paymentPayload));
            } catch (err) {
              fail(new Error(`Solana wallet signing failed: ${err instanceof Error ? err.message : String(err)}`), serverLogs);
              return;
            }
          } else {
            // ── EVM signing path ─────────────────────────────────────────────
            if (!connectedAddress) {
              fail(new Error("No EVM wallet connected — cannot sign payment"), serverLogs);
              return;
            }
            const chainId = req.network === "base-sepolia" ? 84532 : req.network === "base" ? 8453 : 84532;
            const now = Math.floor(Date.now() / 1000);
            const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;

            let signature: `0x${string}`;
            try {
              signature = await signTypedDataAsync({
                domain: {
                  name: req.extra?.name ?? "USD Coin",
                  version: req.extra?.version ?? "2",
                  chainId,
                  verifyingContract: req.asset as `0x${string}`,
                },
                types: {
                  TransferWithAuthorization: [
                    { name: "from", type: "address" },
                    { name: "to", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "validAfter", type: "uint256" },
                    { name: "validBefore", type: "uint256" },
                    { name: "nonce", type: "bytes32" },
                  ],
                },
                primaryType: "TransferWithAuthorization",
                message: {
                  from: connectedAddress,
                  to: req.payTo as `0x${string}`,
                  value: BigInt(req.maxAmountRequired),
                  validAfter: BigInt(now - 600),
                  validBefore: BigInt(now + req.maxTimeoutSeconds),
                  nonce,
                },
              });
            } catch (err) {
              fail(new Error(`Wallet signature rejected: ${err instanceof Error ? err.message : String(err)}`), serverLogs);
              return;
            }

            const paymentPayload = {
              x402Version: payReqs.x402Version,
              scheme: req.scheme,
              network: req.network,
              payload: {
                authorization: {
                  from: connectedAddress,
                  to: req.payTo,
                  value: req.maxAmountRequired,
                  validAfter: (now - 600).toString(),
                  validBefore: (now + req.maxTimeoutSeconds).toString(),
                  nonce,
                },
                signature,
              },
            };
            signedPayment = btoa(JSON.stringify(paymentPayload));
          } // end else (EVM path)

          appendTerminalLogThrottled({
            label: "PAYMENT",
            detail: "Signature received — completing payment…",
            section: "Payment",
          });

          const completeRes = await fetch("/api/core/chat/paid/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
            body: JSON.stringify({ sessionId: paySessId, signedPayment }),
          });
          const completeText = await completeRes.text();
          let completeData: unknown;
          try {
            completeData = JSON.parse(completeText) as unknown;
          } catch {
            fail(new Error(`Backend returned non-JSON after payment (HTTP ${completeRes.status})`));
            return;
          }
          // Replace data/rec/res with completed response for the rest of the handler
          data = completeData;
          const completeRec = completeData as Record<string, unknown>;
          const completeLogs = Array.isArray(completeRec.terminalLogs)
            ? (completeRec.terminalLogs as { label: string; detail: string; section: string }[])
            : serverLogs;

          if (!completeRes.ok || completeRec.ok !== true) {
            const errMsg = typeof completeRec.error === "string"
              ? completeRec.error
              : describeHttpError(completeRes.status, completeRes.statusText, completeText);
            fail(new Error(errMsg), completeLogs);
            return;
          }

          const assistantText =
            typeof completeRec.assistantText === "string" ? completeRec.assistantText : extractAssistantText(completeData);
          const tr = completeRec.terminalReceipt as LiveTerminalReceipt | undefined;

          appendToSessionMessages(sessionId, (prev) =>
            prev.map((m) =>
              m.id === userMessageId && m.role === "user"
                ? { ...m, sendState: "ok" as const, sendError: undefined }
                : m,
            ),
          );
          const already = scriptEntriesFromDisplayedLogs(displayedLogsRef.current);
          const script = buildPostResponseScript(completeLogs, tr, scriptContext, already);
          await new Promise<void>((resolve) => {
            playTerminalScript(script, tr && typeof tr === "object" ? tr : undefined, {
              mode: "append",
              revealReceiptAfter: Boolean(tr && typeof tr === "object"),
              onComplete: () => {
                const captureLogs = displayedLogsRef.current.slice(-30);
                const storedRec: StoredReceipt | undefined = tr ? {
                  subnet: tr.subnet, subnetId: tr.subnetId, costUsd: tr.costUsd,
                  durationMs: tr.durationMs, timestamp: tr.timestamp ?? new Date().toISOString(),
                  intent: tr.intent, reasoning: tr.reasoning,
                  x402TxHash: tr.x402TxHash, x402ExplorerUrl: tr.x402ExplorerUrl, x402Network: tr.x402Network,
                } : undefined;
                appendToSessionMessages(sessionId, (prev) => [
                  ...prev,
                  {
                    id: `live-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    role: "assistant" as const,
                    content: [{ kind: "text" as const, text: assistantText }],
                    receipt: storedRec,
                    terminalLogs: captureLogs,
                  },
                ]);
                setX402Phase("settled");
                setRuntimeError(null);
                void fetchCoreWallet();
                resolve();
              },
            });
          });
          return;
        }

        if (rec.ok !== true) {
          const errMsg = typeof rec.error === "string" ? rec.error : "Paid chat failed";
          fail(new Error(errMsg), serverLogs);
          return;
        }

        const assistantText =
          typeof rec.assistantText === "string" ? rec.assistantText : extractAssistantText(data);
        const tr = rec.terminalReceipt as LiveTerminalReceipt | undefined;

        if (rec.anonUsage && typeof rec.anonUsage === "object") {
          const au = rec.anonUsage as { remaining?: unknown; limit?: unknown };
          if (typeof au.remaining === "number" && typeof au.limit === "number") {
            setAnonUsage({ remaining: au.remaining, limit: au.limit });
          }
        }
        if (rec.anonAiUsage && typeof rec.anonAiUsage === "object") {
          const au = rec.anonAiUsage as { remaining?: unknown; limit?: unknown };
          if (typeof au.remaining === "number" && typeof au.limit === "number") {
            setAnonAiUsage({ remaining: au.remaining, limit: au.limit });
          }
        }

        appendToSessionMessages(sessionId, (prev) =>
          prev.map((m) =>
            m.id === userMessageId && m.role === "user"
              ? { ...m, sendState: "ok" as const, sendError: undefined }
              : m,
          ),
        );

        const already = scriptEntriesFromDisplayedLogs(displayedLogsRef.current);
        const script = buildPostResponseScript(serverLogs, tr, scriptContext, already);

        await new Promise<void>((resolve) => {
          playTerminalScript(script, tr && typeof tr === "object" ? tr : undefined, {
            mode: "append",
            revealReceiptAfter: Boolean(tr && typeof tr === "object"),
            onComplete: () => {
              const captureLogs = displayedLogsRef.current.slice(-30);
              const storedRec: StoredReceipt | undefined = tr ? {
                subnet: tr.subnet, subnetId: tr.subnetId, costUsd: tr.costUsd,
                durationMs: tr.durationMs, timestamp: tr.timestamp ?? new Date().toISOString(),
                intent: tr.intent, reasoning: tr.reasoning,
                x402TxHash: tr.x402TxHash, x402ExplorerUrl: tr.x402ExplorerUrl, x402Network: tr.x402Network,
              } : undefined;
              appendToSessionMessages(sessionId, (prev) => [
                ...prev,
                {
                  id: `live-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                  role: "assistant" as const,
                  content: [{ kind: "text" as const, text: assistantText }],
                  receipt: storedRec,
                  terminalLogs: captureLogs,
                },
              ]);
              setX402Phase("settled");
              setRuntimeError(null);
              void fetchCoreWallet();
              resolve();
            },
          });
        });
      } catch (err) {
        fail(err);
      }
    },
    [
      appendToSessionMessages,
      markUserMessageDelivery,
      fetchCoreWallet,
      scriptContext,
      playTerminalScript,
      appendTerminalLogThrottled,
      connectedAddress,
      signTypedDataAsync,
      solanaPubkey,
      signSolanaTransaction,
      selectedNetwork,
    ],
  );

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const paidForced = USE_TERMINAL_BACKEND_PAID_CHAT && Boolean(forcedSubnetId);
      const hasDirectGeo =
        Boolean(directLat.trim()) && Boolean(directLon.trim());

      if (!trimmed && !paidForced) return;
      if (!trimmed && paidForced && !directImageUrl.trim() && !hasDirectGeo) {
        setDirectGateError(
          "Add a chat message, an image URL, or latitude + longitude before sending.",
        );
        return;
      }

      const userLine =
        trimmed ||
        (directImageUrl.trim() ? "Image verification" : "") ||
        (hasDirectGeo ? "Direct subnet request" : "") ||
        "Direct subnet request";

      const userMsg: ChatMessage = {
        id: `live-user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "user",
        content: [{ kind: "text", text: userLine }],
        sendState: "pending",
      };

      const sessionId = activeSessionIdRef.current;
      if (!sessionId) return;

      if (!isConnected) {
        setRuntimeError(
          USE_TERMINAL_BACKEND_PAID_CHAT
            ? "Payment service is temporarily unavailable. Please try again in a moment."
            : "Engine WebSocket not connected",
        );
        return;
      }

      let paidDirectBody: PaidDirectCallBody | null = null;
      if (paidForced && forcedSubnetId) {
        if (subnetSpecLoading) {
          setDirectGateError("Subnet spec is still loading.");
          return;
        }
        if (subnetYamlSpec && directEndpointPath) {
          // YAML available — build a direct call payload
          const built = computePaidDirectBody(forcedSubnetId, subnetYamlSpec, directEndpointPath, userLine, {
            model: directModel || X402_CHAT_MODEL,
            imageUrl: directImageUrl,
            lat: directLat,
            lon: directLon,
          });
          if (!built.ok) {
            setDirectGateError(built.error);
            return;
          }
          paidDirectBody = built.body;
        }
        // No YAML — fall through with paidDirectBody = null; backend will route
        // the natural-language query to the selected subnet via context.subnet_id.
        setDirectGateError(null);
      }

      const priorThread = (sessions.find((s) => s.id === sessionId)?.messages ?? []).filter(
        (m) => !(m.role === "user" && m.sendState === "failed"),
      );
      const openAiMessages = chatMessagesToOpenAi([...priorThread, userMsg]);

      appendToSessionMessages(sessionId, (prev) => [...prev, userMsg]);
      setIsLoading(true);
      startTerminalPreflight();
      setRuntimeError(null);
      setX402Phase(null);

      if (USE_TERMINAL_BACKEND_PAID_CHAT) {
        try {
          await executeCorePaidChat(sessionId, userMsg.id, openAiMessages, paidDirectBody);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      activeQueryCell.current.value = trimmed || userLine;
      const sid = forcedSubnetIdRef.current;
      sendMessage({
        action: "ask",
        query: trimmed || userLine,
        ...(sid ? { context: { subnet_id: sid } } : {}),
      });
    },
    [
      isConnected,
      sendMessage,
      appendToSessionMessages,
      sessions,
      executeCorePaidChat,
      forcedSubnetId,
      subnetSpecLoading,
      subnetYamlSpec,
      directEndpointPath,
      directModel,
      directImageUrl,
      directLat,
      directLon,
      startTerminalPreflight,
    ],
  );

  const handleRetrySend = useCallback(
    async (messageId: string) => {
      if (isLoading) return;
      const sessionId = activeSessionIdRef.current;
      if (!sessionId) return;
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      const msg = session.messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== "user" || msg.sendState !== "failed") return;
      const text = msg.content
        .filter((c) => c.kind === "text")
        .map((c) => c.text)
        .join("\n")
        .trim();
      if (!text) return;

      if (!isConnected) {
        setRuntimeError(
          USE_TERMINAL_BACKEND_PAID_CHAT
            ? "Payment service is temporarily unavailable. Please try again in a moment."
            : "Engine WebSocket not connected",
        );
        return;
      }

      let paidDirectBody: PaidDirectCallBody | null = null;
      if (USE_TERMINAL_BACKEND_PAID_CHAT && forcedSubnetIdRef.current) {
        const sid = forcedSubnetIdRef.current;
        if (subnetYamlSpec && directEndpointPath) {
          const line =
            text.trim() ||
            (directImageUrl.trim() ? "Image verification" : "") ||
            (directLat.trim() && directLon.trim() ? "Direct subnet request" : "") ||
            "Direct subnet request";
          const built = computePaidDirectBody(sid, subnetYamlSpec, directEndpointPath, line, {
            model: directModel || X402_CHAT_MODEL,
            imageUrl: directImageUrl,
            lat: directLat,
            lon: directLon,
          });
          if (!built.ok) {
            setDirectGateError(built.error);
            return;
          }
          paidDirectBody = built.body;
        }
        setDirectGateError(null);
      }

      const updatedMsgs = session.messages.map((m) =>
        m.id === messageId && m.role === "user"
          ? { ...m, sendState: "pending" as const, sendError: undefined }
          : m,
      );
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            messages: updatedMsgs,
            title: deriveTitle(updatedMsgs),
            updatedAt: Date.now(),
          };
        }),
      );

      const forApi = updatedMsgs.filter(
        (m) => !(m.role === "user" && m.sendState === "failed"),
      );
      const openAiMessages = chatMessagesToOpenAi(forApi);

      setIsLoading(true);
      startTerminalPreflight();
      setRuntimeError(null);
      setX402Phase(null);

      if (USE_TERMINAL_BACKEND_PAID_CHAT) {
        try {
          await executeCorePaidChat(sessionId, messageId, openAiMessages, paidDirectBody);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      activeQueryCell.current.value = text;
      const sid = forcedSubnetIdRef.current;
      sendMessage({
        action: "ask",
        query: text,
        ...(sid ? { context: { subnet_id: sid } } : {}),
      });
    },
    [
      isConnected,
      isLoading,
      sendMessage,
      sessions,
      executeCorePaidChat,
      subnetYamlSpec,
      directEndpointPath,
      directModel,
      directImageUrl,
      directLat,
      directLon,
      startTerminalPreflight,
    ],
  );

  const handleSelectMessageReceipt = useCallback((messageId: string | null) => {
    if (!messageId) {
      setSelectedMsgReceipt(null);
      setSelectedMsgLogs([]);
      return;
    }
    const msg = sessionsRef.current
      .find((s) => s.id === activeSessionIdRef.current)
      ?.messages.find((m) => m.id === messageId);
    if (!msg?.receipt) {
      setSelectedMsgReceipt(null);
      setSelectedMsgLogs([]);
      return;
    }
    // StoredReceipt is structurally compatible with LiveTerminalReceipt (technicalDetails omitted is fine)
    setSelectedMsgReceipt(msg.receipt as unknown as LiveTerminalReceipt);
    setSelectedMsgLogs(msg.terminalLogs ?? []);
  }, []);

  const handleNewChat = useCallback(() => {
    const row = emptySession();
    activeSessionIdRef.current = row.id;
    setActiveSessionId(row.id);
    setSessions((prev) => [row, ...prev]);
    resetTerminalPlayback();
    setIsLoading(false);
    setX402Phase(null);
    setRuntimeError(null);
    activeQueryCell.current.value = null;
    setSelectedMsgReceipt(null);
    setSelectedMsgLogs([]);
  }, [resetTerminalPlayback]);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (!hydrated || id === activeSessionId) return;
      activeSessionIdRef.current = id;
      setActiveSessionId(id);
      resetTerminalPlayback();
      setIsLoading(false);
      setX402Phase(null);
      setRuntimeError(null);
      activeQueryCell.current.value = null;
      setSelectedMsgReceipt(null);
      setSelectedMsgLogs([]);
    },
    [hydrated, activeSessionId, resetTerminalPlayback],
  );

  const chatHistoryGroups: ConversationGroup[] = useMemo(() => {
    if (!hydrated) {
      return [{ label: "Saved chats", items: [] }];
    }
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    const activeItems = sorted.filter((s) => !s.archived);
    const archivedItems = sorted.filter((s) => s.archived);
    const groups: ConversationGroup[] = [
      {
        label: "Saved chats",
        items: activeItems.map((s) => ({
          id: s.id,
          title: s.title || "New chat",
          archived: false,
        })),
      },
    ];
    if (archivedItems.length > 0) {
      groups.push({
        label: "Archived",
        items: archivedItems.map((s) => ({
          id: s.id,
          title: s.title || "New chat",
          archived: true,
        })),
      });
    }
    return groups;
  }, [sessions, hydrated]);

  return {
    messages,
    isLoading,
    terminalLogs,
    terminalReceipt,
    terminalIsRevealing,
    engineError: runtimeError || (USE_TERMINAL_BACKEND_PAID_CHAT ? null : lastError),
    isConnected,
    engineSocketConnected,
    x402Phase,
    backendWalletStatus,
    anonUsage,
    anonExhausted: anonUsage !== null && anonUsage.remaining <= 0,
    anonAiUsage,
    anonAiExhausted: anonAiUsage !== null && anonAiUsage.remaining <= 0,
    useCorePaidChat: USE_TERMINAL_BACKEND_PAID_CHAT,
    useX402Chat: USE_TERMINAL_BACKEND_PAID_CHAT,
    coreWalletFooter: connectedAddress
      ? {
          label: `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}`,
          subtitle: "Base Sepolia",
          initials: connectedAddress.slice(2, 4).toUpperCase(),
        }
      : null,
    selectedMsgReceipt,
    selectedMsgLogs,
    handleSelectMessageReceipt,
    handleSend,
    handleRetrySend,
    handleNewChat,
    chatHistoryGroups,
    activeSessionId,
    handleSelectSession,
    sessionsHydrated: hydrated,
    archiveSession,
    restoreSession,
    deleteSession,
    directSubnetPanel:
      USE_TERMINAL_BACKEND_PAID_CHAT && forcedSubnetId
        ? {
            spec: subnetYamlSpec,
            loading: subnetSpecLoading,
            error: subnetSpecError,
            endpointPath: directEndpointPath,
            setEndpointPath: setDirectEndpointPath,
            model: directModel,
            setModel: setDirectModel,
            modelPlaceholder:
              subnetYamlSpec &&
              forcedSubnetId &&
              subnetYamlSpec.id === forcedSubnetId &&
              directEndpointPath
                ? getDefaultDirectModelForSpec(subnetYamlSpec, directEndpointPath) ?? X402_CHAT_MODEL
                : X402_CHAT_MODEL,
            imageUrl: directImageUrl,
            setImageUrl: setDirectImageUrl,
            lat: directLat,
            setLat: setDirectLat,
            lon: directLon,
            setLon: setDirectLon,
            gateError: directGateError,
          }
        : null,
  };
}
