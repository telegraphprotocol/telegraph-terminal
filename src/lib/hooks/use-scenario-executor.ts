"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  PromptScenario,
  TerminalLogEntry,
  TerminalReceipt,
  ChatMessage,
  promptScenarios,
} from "@/lib/mock-data";

export function useScenarioExecutor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversation, setActiveConversation] = useState<
    string | undefined
  >();
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [terminalShowReceipt, setTerminalShowReceipt] = useState(false);
  const [terminalReceipt, setTerminalReceipt] =
    useState<TerminalReceipt | null>(null);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  const triggerScenario = useCallback(
    (scenario: PromptScenario, userText: string) => {
      clearAllTimeouts();

      // Show the user bubble immediately
      const userMsg: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        role: "user",
        content: [{ kind: "text", text: userText }],
      };
      setMessages([userMsg]);
      setIsLoading(true);
      setTerminalLogs([]);
      setTerminalShowReceipt(false);
      setTerminalReceipt(null);

      const LOG_STREAM_DURATION = 4000; // ms
      const logs = scenario.terminalLogs;
      const logInterval = LOG_STREAM_DURATION / Math.max(logs.length, 1);

      // 1. Stream each log entry
      logs.forEach((log, i) => {
        const t = setTimeout(
          () => {
            setTerminalLogs((prev) => [...prev, log]);
          },
          (i + 1) * logInterval,
        );
        timeoutsRef.current.push(t);
      });

      // 2. Start assistant response while logs are streaming (at 60% mark)
      const assistantStartTime = LOG_STREAM_DURATION * 0.6;
      const assistantMsgId = `msg-assistant-${Date.now()}`;

      const tStartAssistant = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: [{ kind: "text", text: "" }],
          },
        ]);

        // Simulate word-by-word typing
        const words = scenario.response.split(" ");
        words.forEach((word, index) => {
          const tWord = setTimeout(() => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content: [
                        {
                          kind: "text",
                          text:
                            words.slice(0, index + 1).join(" ") +
                            (index < words.length - 1 ? " " : ""),
                        },
                      ],
                    }
                  : m,
              ),
            );
          }, index * 80); // 80ms per word
          timeoutsRef.current.push(tWord);
        });
      }, assistantStartTime);
      timeoutsRef.current.push(tStartAssistant);

      // 3. Finalize: show receipt slightly after logs finish
      const tFinal = setTimeout(() => {
        setTerminalShowReceipt(true);
        setTerminalReceipt(scenario.receipt);
        setIsLoading(false);
      }, LOG_STREAM_DURATION + 500);
      timeoutsRef.current.push(tFinal);
    },
    [clearAllTimeouts],
  );

  const handleSend = useCallback(
    (text: string) => {
      const scenario = promptScenarios.find(
        (s) => s.prompt.toLowerCase() === text.toLowerCase(),
      );
      if (scenario) {
        setActiveConversation(scenario.id);
        triggerScenario(scenario, text);
      } else {
        // Generic fallback for free-text input
        clearAllTimeouts();
        setMessages([
          {
            id: `msg-user-${Date.now()}`,
            role: "user",
            content: [{ kind: "text", text }],
          },
        ]);
        setIsLoading(true);
        setTerminalLogs([]);
        setTerminalShowReceipt(false);
        setTerminalReceipt(null);

        const tFallback = setTimeout(() => {
          const assistantMsgId = `msg-assistant-fallback-${Date.now()}`;
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: "assistant",
              content: [{ kind: "text", text: "Processing your request..." }],
            },
          ]);
          setIsLoading(false);
        }, 1500);
        timeoutsRef.current.push(tFallback);
      }
    },
    [clearAllTimeouts, triggerScenario],
  );

  const handleNewChat = useCallback(() => {
    clearAllTimeouts();
    setMessages([]);
    setIsLoading(false);
    setActiveConversation(undefined);
    setTerminalLogs([]);
    setTerminalShowReceipt(false);
    setTerminalReceipt(null);
  }, [clearAllTimeouts]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      const scenario = promptScenarios.find((s) => s.id === id);
      if (scenario) {
        setActiveConversation(id);
        triggerScenario(scenario, scenario.prompt);
      }
    },
    [triggerScenario],
  );

  return {
    messages,
    isLoading,
    activeConversation,
    terminalLogs,
    terminalShowReceipt,
    terminalReceipt,
    handleSend,
    handleNewChat,
    handleSelectConversation,
  };
}
