"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { EmptyState } from "@/components/empty-state";
import { MobileTerminalCollapsible, TerminalPanel } from "@/components/terminal-panel";
import { useLiveExecutor } from "@/lib/hooks/use-live-executor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function LiveChatPage() {
  const {
    messages,
    isLoading,
    terminalLogs,
    terminalReceipt,
    handleSend,
    handleNewChat,
  } = useLiveExecutor();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setSidebarOpen(true);
  }, []);

  const hasMessages = messages.length > 0;
  const showTerminal = hasMessages || isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:flex-row">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={handleNewChat}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <div className="px-6 pt-3">
              <Link
                href="/live"
                className="inline-flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                <ArrowLeft size={16} />
                <span>Back to Dashboard</span>
              </Link>
            </div>
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
                          showReceipt={!!terminalReceipt}
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

          {showTerminal && (
            <div className="hidden md:flex">
              <TerminalPanel
                logs={terminalLogs}
                showReceipt={!!terminalReceipt}
                receipt={terminalReceipt}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
