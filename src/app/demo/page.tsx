"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { EmptyState } from "@/components/empty-state";
import {
  MobileTerminalCollapsible,
  TerminalPanel,
} from "@/components/terminal-panel";
import { useScenarioExecutor } from "@/lib/hooks/use-scenario-executor";

export default function Home() {
  const {
    messages,
    isLoading,
    activeConversation,
    terminalLogs,
    terminalShowReceipt,
    terminalReceipt,
    handleSend,
    handleNewChat,
    handleSelectConversation,
  } = useScenarioExecutor();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setSidebarOpen(true);
  }, []);

  const hasMessages = messages.length > 0;
  const showTerminal = hasMessages || isLoading;

  const onNewChat = () => {
    handleNewChat();
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const onSelectConversation = (id: string) => {
    handleSelectConversation(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:flex-row">
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
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
      />

      {/* Main area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
                          isLoading={isLoading}
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
