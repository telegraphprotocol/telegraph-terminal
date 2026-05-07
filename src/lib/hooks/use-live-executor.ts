"use client";

import { useState, useCallback } from "react";
import { ChatMessage, TerminalLogEntry } from "@/lib/mock-data";
import { apiClient } from "@/lib/api-client";

export function useLiveExecutor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [terminalReceipt, setTerminalReceipt] = useState<any>(null);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `live-user-${Date.now()}`,
      role: "user",
      content: [{ kind: "text", text }],
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setTerminalLogs([]);
    setTerminalReceipt(null);

    try {
      const result = await apiClient.smartAsk(text);
      
      const assistantMsg: ChatMessage = {
        id: `live-assistant-${Date.now()}`,
        role: "assistant",
        content: [{ kind: "text", text: result.answer }],
      };

      setMessages((prev) => [...prev, assistantMsg]);
      
      // Map API reasoning to terminal logs
      setTerminalLogs(
        (result.logs || []).map((log: any) => ({
          time: log?.time || new Date().toLocaleTimeString(),
          label: log?.label || "ROUTING",
          detail: log?.detail || "Task processed via autonomous engine",
          section: log?.section || "Engine Logic",
        }))
      );
      
      setTerminalReceipt(result.receipt || null);

    } catch (error) {
      console.error("Live API Error:", error);
      const errorMsg: ChatMessage = {
        id: `live-error-${Date.now()}`,
        role: "assistant",
        content: [{ kind: "text", text: "Error: Unable to connect to the Autonomous Engine." }],
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setTerminalLogs([]);
    setTerminalReceipt(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    terminalLogs,
    terminalReceipt,
    handleSend,
    handleNewChat,
  };
}
