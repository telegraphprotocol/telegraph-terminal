"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ChatMessage,
  TerminalLogEntry,
  type ConversationGroup,
} from "@/lib/mock-data";
import { useEngineWS } from "@/lib/hooks/use-engine-ws";
import { EngineAskResult, EngineWsFrame } from "@/lib/engine-daemon-types";

const LS_KEY = "telegraph-live-chat-sessions-v1";
const LS_VERSION = 2 as const;

export type LiveTerminalReceipt = {
  subnet: string;
  subnetId: string;
  costUsd: number;
  durationMs: number;
  timestamp: string;
  intent?: string;
  reasoning?: string;
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

export function useLiveExecutor(opts?: { forcedSubnetId?: string | null }) {
  const forcedSubnetId = opts?.forcedSubnetId ?? null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [terminalReceipt, setTerminalReceipt] = useState<LiveTerminalReceipt | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const { isConnected, lastError, sendMessage, subscribe } = useEngineWS();

  const activeSessionIdRef = useRef<string | null>(null);
  const forcedSubnetIdRef = useRef<string | null>(forcedSubnetId);

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
          Array.isArray(parsed.sessions) &&
          parsed.sessions.length > 0
        ) {
          const normalized: ChatSession[] = parsed.sessions.map((s) => ({
            ...s,
            archived: Boolean((s as ChatSession).archived),
          }));
          setSessions(normalized);
          const aid = parsed.activeSessionId ?? normalized[0].id;
          setActiveSessionId(aid);
          activeSessionIdRef.current = aid;
          setHydrated(true);
          return;
        }
      }
    } catch {
      /* fall through */
    }
    const nid = crypto.randomUUID();
    const initial: ChatSession[] = [
      { id: nid, title: "New chat", updatedAt: Date.now(), messages: [] },
    ];
    setSessions(initial);
    setActiveSessionId(nid);
    activeSessionIdRef.current = nid;
    setHydrated(true);
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

  /** Active id points at a deleted session — jump to another chat or create one. */
  useEffect(() => {
    if (!hydrated) return;
    const cur = sessions.find((s) => s.id === activeSessionId);
    if (cur) return;

    const visible = sessions.filter((s) => !s.archived);
    if (visible.length === 0) {
      const nid = crypto.randomUUID();
      const fresh: ChatSession = {
        id: nid,
        title: "New chat",
        updatedAt: Date.now(),
        messages: [],
      };
      setSessions((prev) => {
        if (prev.some((s) => !s.archived)) return prev;
        return [...prev, fresh];
      });
      activeSessionIdRef.current = nid;
      setActiveSessionId(nid);
    } else {
      const pick = [...visible].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      activeSessionIdRef.current = pick.id;
      setActiveSessionId(pick.id);
    }
    setTerminalLogs([]);
    setTerminalReceipt(null);
    setIsLoading(false);
    setRuntimeError(null);
    activeQueryRef.current = null;
  }, [sessions, activeSessionId, hydrated]);

  const clearTerminalSession = useCallback(() => {
    setTerminalLogs([]);
    setTerminalReceipt(null);
    setIsLoading(false);
    setRuntimeError(null);
    activeQueryRef.current = null;
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
        const nid = crypto.randomUUID();
        switchTo = nid;
        return [
          ...next,
          {
            id: nid,
            title: "New chat",
            updatedAt: Date.now(),
            messages: [],
          },
        ];
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
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const nid = crypto.randomUUID();
        const fresh: ChatSession = {
          id: nid,
          title: "New chat",
          updatedAt: Date.now(),
          messages: [],
        };
        activeSessionIdRef.current = nid;
        setActiveSessionId(nid);
        return [fresh];
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
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sid) return s;
          const nextMsgs = updater(s.messages);
          return {
            ...s,
            messages: nextMsgs,
            title: deriveTitle(nextMsgs),
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [],
  );

  const activeQueryRef = useRef<string | null>(null);

  useEffect(() => {
    return subscribe((frame) => {
      if (!activeQueryRef.current) return;

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
        setRuntimeError(String(frame.data?.message ?? "Engine execution failed"));
        appendToActiveMessages((prev) => [
          ...prev,
          {
            id: `live-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: "assistant",
            content: [
              {
                kind: "text",
                text: `Error: ${String(frame.data?.message ?? "Unable to complete request.")}`,
              },
            ],
          },
        ]);
        setIsLoading(false);
        activeQueryRef.current = null;
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
        activeQueryRef.current = null;
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

      appendToActiveMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setRuntimeError(null);

      if (!isConnected) {
        setRuntimeError("Engine WebSocket not connected");
        appendToActiveMessages((prev) => [
          ...prev,
          {
            id: `live-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: "assistant",
            content: [
              {
                kind: "text",
                text: "Error: Engine connection is offline. Please retry shortly.",
              },
            ],
          },
        ]);
        setIsLoading(false);
        return;
      }

      activeQueryRef.current = text;
      const sid = forcedSubnetIdRef.current;
      sendMessage({
        action: "ask",
        query: text,
        ...(sid ? { context: { subnet_id: sid } } : {}),
      });
    },
    [isConnected, sendMessage, appendToActiveMessages],
  );

  const handleNewChat = useCallback(() => {
    const nid = crypto.randomUUID();
    activeSessionIdRef.current = nid;
    setSessions((prev) => [
      { id: nid, title: "New chat", updatedAt: Date.now(), messages: [] },
      ...prev,
    ]);
    setActiveSessionId(nid);
    setTerminalLogs([]);
    setTerminalReceipt(null);
    setIsLoading(false);
    setRuntimeError(null);
    activeQueryRef.current = null;
  }, []);

  const handleSelectSession = useCallback(
    (id: string) => {
      if (!hydrated || id === activeSessionId) return;
      activeSessionIdRef.current = id;
      setActiveSessionId(id);
      setTerminalLogs([]);
      setTerminalReceipt(null);
      setIsLoading(false);
      setRuntimeError(null);
      activeQueryRef.current = null;
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
    engineError: runtimeError || lastError,
    isConnected,
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
