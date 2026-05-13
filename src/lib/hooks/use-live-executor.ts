"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ChatMessage,
  TerminalLogEntry,
  type ConversationGroup,
  type MessageSendState,
} from "@/lib/mock-data";
import { useEngineWS } from "@/lib/hooks/use-engine-ws";
import { EngineAskResult, EngineWsFrame } from "@/lib/engine-daemon-types";
import { useConnection, useSwitchChain, useWalletClient } from "wagmi";
import { ChainMismatchError } from "viem";
import { getChainId, getPublicClient, getWalletClient } from "@wagmi/core";
import { wagmiConfig } from "@/lib/wagmi-config";
import {
  ensureOnTargetChain,
  isUserRejectedChainError,
} from "@/components/wallet/ensure-base-chain";
import {
  buildEvmX402PaidFetch,
  explorerUrlForSettlement,
  getTelegraphChatUrl,
  settlementFromResponse,
} from "@/lib/x402-telegraph-fetch";

const LS_KEY = "telegraph-live-chat-sessions-v1";
const LS_VERSION = 2 as const;

const USE_X402_CHAT =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_X402_CHAT === "true";

const X402_PREFERRED_EVM_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_X402_PREFERRED_EVM_CHAIN_ID || 84532,
);

const X402_CHAT_MODEL =
  process.env.NEXT_PUBLIC_X402_CHAT_MODEL?.trim() || "gpt-4o-mini";

function preferredChainLabel(chainId: number): string {
  if (chainId === 84532) return "Base Sepolia (84532)";
  if (chainId === 8453) return "Base (8453)";
  if (chainId === 137) return "Polygon (137)";
  return `chain ${chainId}`;
}

export type LiveTerminalReceipt = {
  subnet: string;
  subnetId: string;
  costUsd: number;
  durationMs: number;
  timestamp: string;
  intent?: string;
  reasoning?: string;
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
      section: "Routing",
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
    section: frame.type === "executing" || frame.type === "result" ? "Execution" : "Routing",
  };
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wait until wagmi config chain id matches `chainId` (updates after switchChain).
 * Same signal as `getWalletClient` / signing — not `connector.getChainId()`, which can lag the extension UI.
 */
async function waitForWalletChain(chainId: number, attempts = 25, delayMs = 100): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (getChainId(wagmiConfig) === chainId) return;
    await sleep(delayMs);
  }
  throw new Error("CHAIN_SYNC_TIMEOUT");
}

function friendlyInfraError(err: unknown, preferredChainId: number): string {
  const hint = preferredChainLabel(preferredChainId);
  const raw = err instanceof Error ? err.message : String(err);

  if (err instanceof ChainMismatchError) {
    return `Paid chat signs on ${hint}, but the wallet client reported another chain (often a stale dapp state). Refresh this page, or disconnect and reconnect the wallet with ${hint} selected, then retry.`;
  }
  if (
    raw.includes("does not match the target chain") ||
    raw.includes("does not match the connection") ||
    raw.includes("does not match the connection's chain") ||
    raw.includes("Current Chain ID") ||
    raw.includes("Expected Chain ID")
  ) {
    return `Paid chat expects ${hint}, but the wallet and app disagree on the active chain. If your wallet already shows ${hint}, refresh the page or reconnect the wallet, then retry.`;
  }
  if (raw === "CHAIN_SYNC_TIMEOUT") {
    return `Could not confirm the network switch. Open your wallet, switch to ${hint}, then retry.`;
  }
  if (raw.includes("CHAIN_STILL_WRONG:")) {
    return `The app still sees a different chain than ${hint}. Unlock the wallet, select ${hint} for this site, refresh the page, then retry.`;
  }
  if (isUserRejectedChainError(err)) {
    return `Network switch was cancelled. Switch to ${hint} to use paid chat, then retry.`;
  }
  if (raw === "{}" || raw.trim() === "{}" || raw === "[object Object]") {
    return "Request failed with no clear message from the server. Open TERMINAL → Payment & Rail and look for the latest ERROR line.";
  }
  const maxLen =
    raw.startsWith("x402:") || raw.startsWith("Telegraph chat failed") ? 2000 : 400;
  return raw.length > maxLen ? `${raw.slice(0, maxLen - 1)}…` : raw;
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

export function useLiveExecutor(opts?: { forcedSubnetId?: string | null }) {
  const forcedSubnetId = opts?.forcedSubnetId ?? null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [terminalReceipt, setTerminalReceipt] = useState<LiveTerminalReceipt | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [x402Phase, setX402Phase] = useState<null | "paying" | "settled">(null);
  const { isConnected: engineSocketConnected, lastError, sendMessage, subscribe } = useEngineWS();

  const connection = useConnection();
  const { data: walletClient } = useWalletClient();
  const { mutateAsync: switchChainAsync } = useSwitchChain();

  const evmWalletReady =
    connection.status === "connected" &&
    connection.chainId != null &&
    Boolean(walletClient?.account);

  const isConnected = USE_X402_CHAT ? evmWalletReady : engineSocketConnected;

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
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setIsLoading(false);
      setX402Phase(null);
      setRuntimeError(null);
      activeQueryCell.current.value = null;
    });
  }, [sessions, activeSessionId, hydrated]);

  const clearTerminalSession = useCallback(() => {
    setTerminalLogs([]);
    setTerminalReceipt(null);
    setIsLoading(false);
    setX402Phase(null);
    setRuntimeError(null);
    activeQueryCell.current.value = null;
  }, []);

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

      setTerminalLogs((prev) => [...prev, toLog(frame)]);

      if (frame.type === "routed" && frame.data?.reasoning) {
        setTerminalLogs((prev) => [
          ...prev,
          {
            time: toTimeLabel(frame.timestamp),
            label: "REASONING",
            detail: String(frame.data?.reasoning),
            section: "Routing",
          },
        ]);
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
              role: "assistant",
              content: [{ kind: "text", text: assistantText }],
            },
          ];
        });
        setTerminalReceipt({
          subnet: resultData.subnet_name,
          subnetId: String(resultData.subnet_used ?? resultData.subnet_id ?? "n/a"),
          costUsd: resultData.cost_usd ?? 0,
          durationMs: resultData.duration_ms ?? 0,
          timestamp: resultData.timestamp,
          intent: resultData.intent,
          reasoning: resultData.reasoning,
        });
        setIsLoading(false);
        activeQueryCell.current.value = null;
      }
    });
  }, [subscribe, appendToActiveMessages, markUserMessageDelivery]);

  const executeX402Request = useCallback(
    async (
      sessionId: string,
      userMessageId: string,
      openAiMessages: { role: "user" | "assistant" | "system"; content: string }[],
    ) => {
      const pushLog = (label: string, detail: string) => {
        const time = new Date().toLocaleTimeString();
        setTerminalLogs((prev) => [
          ...prev,
          { time, label, detail, section: "Payment & Rail" },
        ]);
      };
      const fail = (err: unknown) => {
        pushLog("ERROR", formatErrorForLog(err));
        const msg = friendlyInfraError(err, X402_PREFERRED_EVM_CHAIN_ID);
        markUserMessageDelivery(sessionId, userMessageId, {
          sendState: "failed",
          sendError: msg,
        });
        setRuntimeError(msg);
        setX402Phase(null);
      };

      const t0 = performance.now();
      try {
        const preferred = X402_PREFERRED_EVM_CHAIN_ID;

        /** Optional connector read for logs only — can disagree with wagmi after switch. */
        const readConnectorChainId = async (): Promise<number | null> => {
          const connector = connection.connector;
          if (connector?.getChainId) {
            try {
              return await connector.getChainId();
            } catch {
              return null;
            }
          }
          if (connection.chainId != null) return connection.chainId;
          return null;
        };

        const wagmiChainId = (): number => getChainId(wagmiConfig);

        if (wagmiChainId() !== preferred) {
          const connectorHint = (await readConnectorChainId()) ?? wagmiChainId();
          pushLog(
            "NETWORK",
            `Switching wallet to chain ${preferred} for x402 (wagmi ${wagmiChainId()}; connector ${connectorHint})…`,
          );
          const maxSwitchAttempts = 3;
          for (let attempt = 0; attempt < maxSwitchAttempts; attempt++) {
            if (attempt > 0) {
              pushLog(
                "NETWORK",
                `Retrying network switch (attempt ${attempt + 1}/${maxSwitchAttempts})…`,
              );
            }
            try {
              await ensureOnTargetChain(
                switchChainAsync,
                preferred,
                walletClient ?? undefined,
              );
            } catch (switchErr) {
              fail(switchErr);
              return;
            }
            try {
              await waitForWalletChain(preferred);
              break;
            } catch {
              if (attempt === maxSwitchAttempts - 1) {
                fail(new Error("CHAIN_SYNC_TIMEOUT"));
                return;
              }
            }
          }
        }

        if (wagmiChainId() !== preferred) {
          fail(
            new Error(
              `CHAIN_STILL_WRONG: wagmi reports chain id ${wagmiChainId()} but paid chat requires ${preferred} (${preferredChainLabel(preferred)}).`,
            ),
          );
          return;
        }

        pushLog("X402", "Completing x402 payment (402 → sign → retry)…");
        setX402Phase("paying");

        let wc;
        try {
          wc = await getWalletClient(wagmiConfig, {
            chainId: X402_PREFERRED_EVM_CHAIN_ID,
          });
        } catch (wErr) {
          fail(wErr);
          return;
        }

        if (!wc.account) {
          fail(new Error("Wallet has no active account. Unlock your wallet and retry."));
          return;
        }

        const pc = getPublicClient(wagmiConfig, {
          chainId: X402_PREFERRED_EVM_CHAIN_ID,
        });
        const paidFetch = buildEvmX402PaidFetch(wc, pc, X402_PREFERRED_EVM_CHAIN_ID);

        const url = getTelegraphChatUrl();
        pushLog("X402", `POST ${url} (paid fetch)…`);
        const res = await paidFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            model: X402_CHAT_MODEL,
            messages: openAiMessages,
          }),
        });

        const durationMs = Math.round(performance.now() - t0);
        pushLog("X402", `Response ${res.status} ${res.ok ? "OK" : "not OK"} (${Math.round(durationMs)} ms).`);
        const settled = settlementFromResponse(res);
        const explorerUrl = settled ? explorerUrlForSettlement(settled) : null;

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(describeHttpError(res.status, res.statusText, errText));
        }

        const json = (await res.json()) as unknown;
        const assistantText = extractAssistantText(json);

        appendToSessionMessages(sessionId, (prev) => {
          const withOkUser = prev.map((m) =>
            m.id === userMessageId && m.role === "user"
              ? { ...m, sendState: "ok" as const, sendError: undefined }
              : m,
          );
          return [
            ...withOkUser,
            {
              id: `live-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              role: "assistant" as const,
              content: [{ kind: "text" as const, text: assistantText }],
            },
          ];
        });

        const minPrice = Number(process.env.NEXT_PUBLIC_MIN_PRICE_USDC ?? "0.05");
        setTerminalReceipt({
          subnet: "Telegraph subnet 102 (x402)",
          subnetId: "102",
          costUsd: Number.isFinite(minPrice) ? minPrice : 0.05,
          durationMs,
          timestamp: new Date().toISOString(),
          intent: "direct_http_x402",
          reasoning: `POST ${url}`,
          x402TxHash: settled?.transaction,
          x402ExplorerUrl: explorerUrl ?? undefined,
          x402Network: settled?.network,
        });

        if (settled?.transaction && explorerUrl) {
          pushLog("SETTLED", `tx ${settled.transaction.slice(0, 10)}… — ${explorerUrl}`);
        } else {
          pushLog("SETTLED", "Payment verified; no explorer metadata in response headers.");
        }

        setX402Phase("settled");
        setRuntimeError(null);
      } catch (err) {
        fail(err);
      }
    },
    [
      appendToSessionMessages,
      connection,
      markUserMessageDelivery,
      switchChainAsync,
      walletClient,
    ],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: `live-user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "user",
        content: [{ kind: "text", text }],
        sendState: "pending",
      };

      const sessionId = activeSessionIdRef.current;
      if (!sessionId) return;

      if (!isConnected) {
        setRuntimeError(
          USE_X402_CHAT
            ? "Connect your wallet on Base Sepolia or Polygon to send paid chat."
            : "Engine WebSocket not connected",
        );
        return;
      }

      if (USE_X402_CHAT && process.env.NEXT_PUBLIC_DEFAULT_NETWORK === "solana") {
        setRuntimeError("x402 chat via Solana is not wired in this build.");
        return;
      }

      const priorThread = (sessions.find((s) => s.id === sessionId)?.messages ?? []).filter(
        (m) => !(m.role === "user" && m.sendState === "failed"),
      );
      const openAiMessages = chatMessagesToOpenAi([...priorThread, userMsg]);

      appendToSessionMessages(sessionId, (prev) => [...prev, userMsg]);
      setIsLoading(true);
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setRuntimeError(null);
      setX402Phase(null);

      if (USE_X402_CHAT) {
        try {
          await executeX402Request(sessionId, userMsg.id, openAiMessages);
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
    [isConnected, sendMessage, appendToSessionMessages, sessions, executeX402Request],
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
          USE_X402_CHAT
            ? "Connect your wallet on Base Sepolia or Polygon to send paid chat."
            : "Engine WebSocket not connected",
        );
        return;
      }

      if (USE_X402_CHAT && process.env.NEXT_PUBLIC_DEFAULT_NETWORK === "solana") {
        setRuntimeError("x402 chat via Solana is not wired in this build.");
        return;
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
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setRuntimeError(null);
      setX402Phase(null);

      if (USE_X402_CHAT) {
        try {
          await executeX402Request(sessionId, messageId, openAiMessages);
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
    [isConnected, isLoading, sendMessage, sessions, executeX402Request],
  );

  const handleNewChat = useCallback(() => {
    const row = emptySession();
    activeSessionIdRef.current = row.id;
    setActiveSessionId(row.id);
    setSessions((prev) => [row, ...prev]);
    setTerminalLogs([]);
    setTerminalReceipt(null);
    setIsLoading(false);
    setX402Phase(null);
    setRuntimeError(null);
    activeQueryCell.current.value = null;
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (!hydrated || id === activeSessionId) return;
      activeSessionIdRef.current = id;
      setActiveSessionId(id);
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setIsLoading(false);
      setX402Phase(null);
      setRuntimeError(null);
      activeQueryCell.current.value = null;
    },
    [hydrated, activeSessionId],
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
    engineError: runtimeError || (USE_X402_CHAT ? null : lastError),
    isConnected,
    engineSocketConnected,
    x402Phase,
    useX402Chat: USE_X402_CHAT,
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
  };
}
