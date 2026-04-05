"use client";

import { useState, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { EmptyState } from "@/components/empty-state";
import {
  MobileTerminalCollapsible,
  TerminalPanel,
} from "@/components/terminal-panel";
import {
  promptScenarios,
  ChatMessage,
  TerminalLogEntry,
  TerminalReceipt,
  PromptScenario,
} from "@/lib/mock-data";

let msgCounter = 100;
const STREAM_DURATION = 5000; // ms – total time for log streaming

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeConversation, setActiveConversation] = useState<
    string | undefined
  >();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Terminal panel state
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [terminalShowReceipt, setTerminalShowReceipt] = useState(false);
  const [terminalReceipt, setTerminalReceipt] =
    useState<TerminalReceipt | null>(null);

  // Keep timeout IDs so we can cancel on new request
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  const hasMessages = messages.length > 0;
  const showTerminal = hasMessages || isLoading;

  // ── Core streaming logic ──────────────────────────────────────────────────

  const triggerScenario = (scenario: PromptScenario, userText: string) => {
    clearAllTimeouts();

    // Show the user bubble immediately
    const userMsg: ChatMessage = {
      id: `msg-${++msgCounter}`,
      role: "user",
      content: [{ kind: "text", text: userText }],
    };
    setMessages([userMsg]);
    setIsLoading(true);
    setTerminalLogs([]);
    setTerminalShowReceipt(false);
    setTerminalReceipt(null);

    // Stream each log entry evenly across STREAM_DURATION
    const logs = scenario.terminalLogs;
    const interval = STREAM_DURATION / (logs.length + 1);

    logs.forEach((log, i) => {
      const t = setTimeout(
        () => {
          setTerminalLogs((prev) => [...prev, log]);
        },
        (i + 1) * interval,
      );
      timeoutsRef.current.push(t);
    });

    // After all logs: show receipt + assistant reply
    const finalT = setTimeout(() => {
      setTerminalShowReceipt(true);
      setTerminalReceipt(scenario.receipt);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${++msgCounter}`,
          role: "assistant",
          content: [{ kind: "text", text: scenario.response }],
        },
      ]);
      setIsLoading(false);
    }, STREAM_DURATION);
    timeoutsRef.current.push(finalT);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSend = (text: string) => {
    const scenario = promptScenarios.find((s) => s.prompt === text);
    if (scenario) {
      setActiveConversation(scenario.id);
      triggerScenario(scenario, text);
    } else {
      // Generic fallback for free-text input
      clearAllTimeouts();
      setMessages([
        {
          id: `msg-${++msgCounter}`,
          role: "user",
          content: [{ kind: "text", text }],
        },
      ]);
      setIsLoading(true);
      setTerminalLogs([]);
      setTerminalShowReceipt(false);
      setTerminalReceipt(null);
      const t = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${++msgCounter}`,
            role: "assistant",
            content: [{ kind: "text", text: "Processing your request…" }],
          },
        ]);
        setIsLoading(false);
      }, 2000);
      timeoutsRef.current.push(t);
    }
  };

  const handleNewChat = () => {
    clearAllTimeouts();
    setMessages([]);
    setIsLoading(false);
    setActiveConversation(undefined);
    setTerminalLogs([]);
    setTerminalShowReceipt(false);
    setTerminalReceipt(null);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    const scenario = promptScenarios.find((s) => s.id === id);
    if (scenario) triggerScenario(scenario, scenario.prompt);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((v) => !v)}
        activeId={activeConversation}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {hasMessages ? (
                <ChatArea
                  messages={messages}
                  isLoading={isLoading}
                  mobileTerminal={
                    showTerminal ? (
                      <div className="md:hidden">
                        <MobileTerminalCollapsible
                          logs={terminalLogs}
                          showReceipt={terminalShowReceipt}
                          receipt={terminalReceipt}
                        />
                      </div>
                    ) : null
                  }
                />
              ) : (
                <EmptyState onQuestionClick={handleSend} />
              )}
            </div>
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </div>

          {/* Right terminal panel — desktop only, visible during and after streaming */}
          {showTerminal && (
            <div className="hidden md:flex">
              <TerminalPanel
                logs={terminalLogs}
                showReceipt={terminalShowReceipt}
                receipt={terminalReceipt}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
