"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ChatMessage,
  TerminalLogEntry,
  type ConversationGroup,
} from "@/lib/mock-data";
import { useEngineWS } from "@/lib/hooks/use-engine-ws";
import { EngineAskResult, EngineWsFrame } from "@/lib/engine-daemon-types";
import { useConnection, useSwitchChain, useWalletClient } from "wagmi";
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

function sessionHasMessages(s: ChatSession): boolean {
  return s.messages.length > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait until wagmi config `state.chainId` matches (updates after switchChain). */
async function waitForWalletChain(chainId: number, attempts = 25, delayMs = 100): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    if (getChainId(wagmiConfig) === chainId) return;
    await sleep(delayMs);
  }
  throw new Error("CHAIN_SYNC_TIMEOUT");
}

function friendlyInfraError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (
    raw.includes("does not match the connection") ||
    raw.includes("Current Chain ID") ||
    raw.includes("Expected Chain ID")
  ) {
    return "Wallet network mismatch: approve switching to Base Sepolia (chain 84532) in your wallet, then try again.";
  }
  if (raw === "CHAIN_SYNC_TIMEOUT") {
    return "Could not confirm the network switch. Open your wallet, switch to Base Sepolia (84532), then retry.";
  }
  if (isUserRejectedChainError(err)) {
    return "Network switch was cancelled. Switch to Base Sepolia (84532) to use paid chat, then retry.";
  }
  return raw.length > 280 ? `${raw.slice(0, 277)}…` : raw;
}

function chatMessagesToOpenAi(
  msgs: ChatMessage[],
): { role: "user" | "assistant" | "system"; content: string }[] {
  const out: { role: "user" | "assistant" | "system"; content: string }[] = [];
  for (const m of msgs) {
    if (m.role !== "user" && m.role !== "assistant") continue;
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
  /** When set, `activeSessionId` is a draft thread not yet in `sessions` (no sidebar row). */
  const draftSessionIdRef = useRef<string | null>(null);
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
            archived: Boolean((s as ChatSession).archived),
          }));
          const withMsgs = normalized.filter(sessionHasMessages);
          queueMicrotask(() => {
            setSessions(withMsgs);
            let aid = parsed.activeSessionId;
            if (!aid || !withMsgs.some((s) => s.id === aid)) {
              aid = withMsgs[0]?.id ?? crypto.randomUUID();
            }
            setActiveSessionId(aid);
            activeSessionIdRef.current = aid;
            draftSessionIdRef.current =
              withMsgs.length === 0 || !withMsgs.some((s) => s.id === aid) ? aid : null;
            setHydrated(true);
          });
          return;
        }
      }
    } catch {
      /* fall through */
    }
    const nid = crypto.randomUUID();
    queueMicrotask(() => {
      setSessions([]);
      setActiveSessionId(nid);
      activeSessionIdRef.current = nid;
      draftSessionIdRef.current = nid;
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

  /** Active id missing from sessions: deleted session — pick another. Skip while on draft new chat. */
  useEffect(() => {
    if (!hydrated || !activeSessionId) return;
    const cur = sessions.find((s) => s.id === activeSessionId);
    if (cur) return;
    if (draftSessionIdRef.current === activeSessionId) return;

    const visible = sessions.filter((s) => !s.archived && sessionHasMessages(s));
    queueMicrotask(() => {
      if (visible.length === 0) {
        const nid = crypto.randomUUID();
        activeSessionIdRef.current = nid;
        setActiveSessionId(nid);
        draftSessionIdRef.current = nid;
      } else {
        const pick = [...visible].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        activeSessionIdRef.current = pick.id;
        setActiveSessionId(pick.id);
        draftSessionIdRef.current = null;
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
    let switchedToDraft = false;
    setSessions((prev) => {
      const next = prev.map((s) =>
        s.id === id ? { ...s, archived: true } : s,
      );
      if (activeSessionIdRef.current !== id) return next;
      const visible = next.filter((s) => !s.archived && sessionHasMessages(s));
      if (visible.length === 0) {
        switchTo = crypto.randomUUID();
        switchedToDraft = true;
        return next;
      }
      switchTo = [...visible].sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
      switchedToDraft = false;
      return next;
    });
    if (switchTo !== null) {
      activeSessionIdRef.current = switchTo;
      draftSessionIdRef.current = switchedToDraft ? switchTo : null;
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
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const nid = crypto.randomUUID();
        activeSessionIdRef.current = nid;
        draftSessionIdRef.current = nid;
        setActiveSessionId(nid);
        return [];
      }
      return next;
    });
  }, []);

  const messages = useMemo(() => {
    if (!activeSessionId) return [];
    return sessions.find((s) => s.id === activeSessionId)?.messages ?? [];
  }, [sessions, activeSessionId]);

  const appendToActiveMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const sid = activeSessionIdRef.current;
      if (!sid) return;
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === sid);
        if (idx === -1) {
          const nextMsgs = updater([]);
          if (nextMsgs.length === 0) return prev;
          draftSessionIdRef.current = null;
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

  const revertOptimisticUserMessage = useCallback((userMsgId: string) => {
    const sid = activeSessionIdRef.current;
    if (!sid) return;
    setSessions((prev) =>
      prev.flatMap((s) => {
        if (s.id !== sid) return [s];
        const nextMsgs = s.messages.filter((m) => m.id !== userMsgId);
        if (nextMsgs.length === 0) return [];
        return [
          {
            ...s,
            messages: nextMsgs,
            title: deriveTitle(nextMsgs),
            updatedAt: Date.now(),
          },
        ];
      }),
    );
  }, []);

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
        if (activeSessionIdRef.current) {
          const sid = activeSessionIdRef.current;
          setSessions((prev) =>
            prev.flatMap((s) => {
              if (s.id !== sid) return [s];
              const lastUser = [...s.messages].reverse().find((m) => m.role === "user");
              if (!lastUser) return [s];
              const nextMsgs = s.messages.filter((m) => m.id !== lastUser.id);
              if (nextMsgs.length === 0) return [];
              return [
                {
                  ...s,
                  messages: nextMsgs,
                  title: deriveTitle(nextMsgs),
                  updatedAt: Date.now(),
                },
              ];
            }),
          );
        }
        setIsLoading(false);
        activeQueryCell.current.value = null;
      }

      if (frame.type === "result" && frame.data) {
        const resultData = frame.data as unknown as EngineAskResult;
        const assistantText = extractAssistantText(resultData.result);
        appendToActiveMessages((prev) => [
          ...prev,
          {
            id: `live-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: "assistant",
            content: [{ kind: "text", text: assistantText }],
          },
        ]);
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
  }, [subscribe, appendToActiveMessages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: `live-user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: "user",
        content: [{ kind: "text", text }],
      };

      const sessionId = activeSessionIdRef.current;

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

      const priorThread = sessions.find((s) => s.id === sessionId)?.messages ?? [];
      const threadForApi = [...priorThread, userMsg];

      appendToActiveMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setRuntimeError(null);
      setX402Phase(null);

      if (USE_X402_CHAT) {
        const pushLog = (label: string, detail: string) => {
          const time = new Date().toLocaleTimeString();
          setTerminalLogs((prev) => [
            ...prev,
            { time, label, detail, section: "Payment & Rail" },
          ]);
        };

        const t0 = performance.now();

        try {
          if (connection.chainId !== X402_PREFERRED_EVM_CHAIN_ID) {
            pushLog(
              "NETWORK",
              `Switching wallet to chain ${X402_PREFERRED_EVM_CHAIN_ID} for x402…`,
            );
            try {
              await ensureOnTargetChain(switchChainAsync, X402_PREFERRED_EVM_CHAIN_ID);
            } catch (switchErr) {
              revertOptimisticUserMessage(userMsg.id);
              setRuntimeError(friendlyInfraError(switchErr));
              setIsLoading(false);
              return;
            }
          }

          try {
            await waitForWalletChain(X402_PREFERRED_EVM_CHAIN_ID);
          } catch {
            revertOptimisticUserMessage(userMsg.id);
            setRuntimeError(friendlyInfraError(new Error("CHAIN_SYNC_TIMEOUT")));
            setIsLoading(false);
            return;
          }

          pushLog("X402", "Completing x402 payment (402 → sign → retry)…");
          setX402Phase("paying");

          let wc;
          try {
            wc = await getWalletClient(wagmiConfig);
          } catch (wErr) {
            revertOptimisticUserMessage(userMsg.id);
            setRuntimeError(friendlyInfraError(wErr));
            setIsLoading(false);
            return;
          }

          if (!wc.account) {
            revertOptimisticUserMessage(userMsg.id);
            setRuntimeError("Wallet has no active account. Unlock your wallet and retry.");
            setIsLoading(false);
            return;
          }

          const pc = getPublicClient(wagmiConfig, {
            chainId: X402_PREFERRED_EVM_CHAIN_ID,
          });
          const paidFetch = buildEvmX402PaidFetch(wc, pc, X402_PREFERRED_EVM_CHAIN_ID);

          const url = getTelegraphChatUrl();
          const openAiMessages = chatMessagesToOpenAi(threadForApi);
          const res = await paidFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              model: X402_CHAT_MODEL,
              messages: openAiMessages,
            }),
          });

          const durationMs = Math.round(performance.now() - t0);
          const settled = settlementFromResponse(res);
          const explorerUrl = settled ? explorerUrlForSettlement(settled) : null;

          if (!res.ok) {
            const errText = await res.text().catch(() => "");
            throw new Error(errText || `HTTP ${res.status}`);
          }

          const json = (await res.json()) as unknown;
          const assistantText = extractAssistantText(json);

          appendToActiveMessages((prev) => [
            ...prev,
            {
              id: `live-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              role: "assistant",
              content: [{ kind: "text", text: assistantText }],
            },
          ]);

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
        } catch (err) {
          revertOptimisticUserMessage(userMsg.id);
          setRuntimeError(friendlyInfraError(err));
          setX402Phase(null);
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
      sendMessage,
      appendToActiveMessages,
      revertOptimisticUserMessage,
      sessions,
      connection.chainId,
      switchChainAsync,
    ],
  );

  const handleNewChat = useCallback(() => {
    const nid = crypto.randomUUID();
    activeSessionIdRef.current = nid;
    draftSessionIdRef.current = nid;
    setActiveSessionId(nid);
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
      draftSessionIdRef.current = null;
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
    const activeItems = sorted.filter((s) => !s.archived && sessionHasMessages(s));
    const archivedItems = sorted.filter((s) => s.archived && sessionHasMessages(s));
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
