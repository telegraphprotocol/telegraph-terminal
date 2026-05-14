"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { EmptyState } from "@/components/empty-state";
import { MobileTerminalCollapsible, TerminalPanel } from "@/components/terminal-panel";
import { useLiveExecutor } from "@/lib/hooks/use-live-executor";
import { apiClient } from "@/lib/api-client";
import { normalizeEngineSubnets, type SubnetPickItem } from "@/lib/subnet-catalog";

export default function LiveChatPage() {
  const [forcedSubnetId, setForcedSubnetId] = useState<string | null>(null);
  const [engineSubnets, setEngineSubnets] = useState<SubnetPickItem[]>([]);
  const [subnetsLoading, setSubnetsLoading] = useState(true);
  const [subnetsError, setSubnetsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.listSubnets();
        if (!cancelled) {
          setEngineSubnets(normalizeEngineSubnets(data));
          setSubnetsError(null);
        }
      } catch {
        if (!cancelled) {
          setEngineSubnets([]);
          setSubnetsError("Could not reach engine `/v1/subnets`. Is it running?");
        }
      } finally {
        if (!cancelled) setSubnetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    messages,
    isLoading,
    terminalLogs,
    terminalReceipt,
    engineError,
    isConnected,
    engineSocketConnected,
    x402Phase,
    useX402Chat,
    coreWalletFooter,
    handleSend,
    handleRetrySend,
    handleNewChat,
    chatHistoryGroups,
    activeSessionId,
    handleSelectSession,
    archiveSession,
    restoreSession,
    deleteSession,
  } = useLiveExecutor({ forcedSubnetId });

  /**
   * Until layout runs on the client, keep sidebar visually "closed" so SSR HTML matches the first
   * client render (avoids overlay `<div>` vs `<aside>` order mismatch during hydration).
   */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLayoutReady, setSidebarLayoutReady] = useState(false);

  useLayoutEffect(() => {
    setSidebarLayoutReady(true);
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setSidebarOpen(true);
  }, []);

  const effectiveSidebarOpen = sidebarLayoutReady ? sidebarOpen : false;

  const hasMessages = messages.length > 0;
  const showTerminal = hasMessages || isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:flex-row">
      {effectiveSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={effectiveSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen((v) => !v)}
        historyGroups={chatHistoryGroups}
        activeId={activeSessionId ?? undefined}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
        walletFooter={coreWalletFooter}
        liveChatActions={{
          onArchive: archiveSession,
          onRestore: restoreSession,
          onDelete: deleteSession,
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav
          sidebarOpen={effectiveSidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          backToDashboardHref="/"
          subnetPicker={{
            subnets: engineSubnets,
            selectedSubnetId: forcedSubnetId,
            onSubnetChange: setForcedSubnetId,
            loading: subnetsLoading,
            error: subnetsError,
          }}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden min-w-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {((useX402Chat ? !isConnected : !engineSocketConnected) || engineError) && (
                <div className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 sm:mx-6">
                  {engineError ||
                    (useX402Chat
                      ? "Core wallet proxy is not ready. Ensure telegraph-core is running and Next has CORE_API_KEY / CORE_INTERNAL_URL set."
                      : "Engine connection unavailable. Retrying...")}
                </div>
              )}
              {hasMessages ? (
                <ChatArea
                  messages={messages}
                  isLoading={isLoading}
                  loadingHint={
                    useX402Chat && x402Phase === "paying"
                      ? "Processing payment and chat on Core…"
                      : undefined
                  }
                  onRetrySend={handleRetrySend}
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
