"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { DirectSubnetFields } from "@/components/direct-subnet-fields";
import { EmptyState } from "@/components/empty-state";
import { HowItWorksButton } from "@/components/how-it-works-button";
import { NetworkSelector } from "@/components/network-selector";
import { MobileTerminalCollapsible, TerminalPanel } from "@/components/terminal-panel";
import { ConnectWalletModal } from "@/components/auth/connect-wallet-modal";
import { WalletChoiceModal } from "@/components/auth/wallet-choice-modal";
import { DepositModal } from "@/components/auth/deposit-modal";
import { useLiveExecutor } from "@/lib/hooks/use-live-executor";
import { apiClient } from "@/lib/api-client";
import { getToken, authHeaders } from "@/lib/auth";
import {
  normalizeEngineSubnets,
  type SubnetPickItem,
} from "@/lib/subnet-catalog";

type AuthState = "loading" | "unauthenticated" | "wallet-choice" | "deposit" | "ready";

export default function LiveChatPage() {
  const [forcedSubnetId, setForcedSubnetId] = useState<string | null>(null);
  const [engineSubnets, setEngineSubnets] = useState<SubnetPickItem[]>([]);
  const [subnetsLoading, setSubnetsLoading] = useState(true);
  const [subnetsError, setSubnetsError] = useState<string | null>(null);

  // Auth state machine
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [depositWalletAddress, setDepositWalletAddress] = useState<string | null>(null);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthState("unauthenticated");
      return;
    }
    // Verify token is still valid and check walletMode
    fetch("/api/auth/me", { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!me) {
          setAuthState("unauthenticated");
          return;
        }
        if (!me.walletMode) {
          setAuthState("wallet-choice");
        } else {
          setAuthState("ready");
        }
      })
      .catch(() => setAuthState("unauthenticated"));
  }, []);

  const handleAuthenticated = useCallback(() => {
    setWalletPromptOpen(false);
    // After JWT obtained, check walletMode
    fetch("/api/auth/me", { headers: authHeaders() })
      .then((r) => r.json())
      .then((me) => {
        if (!me?.walletMode) setAuthState("wallet-choice");
        else setAuthState("ready");
      })
      .catch(() => setAuthState("wallet-choice"));
  }, []);

  const handlePrivyCreated = useCallback((walletAddress: string) => {
    setDepositWalletAddress(walletAddress);
    setAuthState("deposit");
  }, []);

  const handleExternalChosen = useCallback(() => {
    setAuthState("ready");
  }, []);

  const handleDepositClose = useCallback(() => {
    setAuthState("ready");
  }, []);

  // Load engine subnets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.listSubnets();
        if (cancelled) return;
        const normalized = normalizeEngineSubnets(data);
        setEngineSubnets(normalized);
        setSubnetsError(null);
      } catch {
        if (!cancelled) {
          setEngineSubnets([]);
          setSubnetsError("Routing service is temporarily unavailable. Please try again shortly.");
        }
      } finally {
        if (!cancelled) setSubnetsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setForcedSubnetId((prev) => {
      if (prev == null) return prev;
      return engineSubnets.some((s) => s.id === prev) ? prev : null;
    });
  }, [engineSubnets]);

  const {
    messages,
    isLoading,
    terminalLogs,
    terminalReceipt,
    terminalIsRevealing,
    engineError,
    engineSocketConnected,
    x402Phase,
    backendWalletStatus,
    anonUsage,
    anonExhausted,
    anonAiUsage,
    anonAiExhausted,
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
    directSubnetPanel,
  } = useLiveExecutor({ forcedSubnetId, engineSubnets });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLayoutReady, setSidebarLayoutReady] = useState(false);

  useLayoutEffect(() => {
    setSidebarLayoutReady(true);
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setSidebarOpen(true);
  }, []);

  const effectiveSidebarOpen = sidebarLayoutReady ? sidebarOpen : false;
  const isSubnetMode = Boolean(forcedSubnetId);
  const hasMessages = messages.length > 0;
  const showTerminal = hasMessages || isLoading;

  let chatLoadingHint: string | undefined;
  if (useX402Chat) {
    chatLoadingHint =
      x402Phase === "paying"
        ? "Processing x402 payment…"
        : "Waiting for Terminal Backend and Telegraph…";
  }

  const showConnectionBanner =
    Boolean(engineError) ||
    (useX402Chat && backendWalletStatus === "unavailable") ||
    (!useX402Chat && !engineSocketConnected);

  const connectionBannerMessage =
    engineError ??
    (useX402Chat
      ? "Payment service is temporarily unavailable. Please try again in a moment."
      : "Engine connection unavailable. Retrying...");

  return (
    <>
      {/* Auth modals — rendered above everything */}
      {authState === "unauthenticated" && walletPromptOpen && (
        <ConnectWalletModal onAuthenticated={handleAuthenticated} onClose={() => setWalletPromptOpen(false)} />
      )}
      {authState === "wallet-choice" && (
        <WalletChoiceModal
          onPrivyCreated={handlePrivyCreated}
          onExternalChosen={handleExternalChosen}
        />
      )}
      {authState === "deposit" && depositWalletAddress && (
        <DepositModal walletAddress={depositWalletAddress} onClose={handleDepositClose} />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background bg-dot-grid md:flex-row">
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
          subnetPicker={{
            subnets: engineSubnets,
            selectedSubnetId: forcedSubnetId,
            onSubnetChange: setForcedSubnetId,
            loading: subnetsLoading,
            error: subnetsError,
          }}
          anonAiExhausted={anonAiExhausted}
          anonUsage={anonUsage}
          anonExhausted={anonExhausted}
          onConnectWallet={() => setWalletPromptOpen(true)}
          showSubnetQuota={authState === "unauthenticated"}
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
            extraActions={
              <>
                {process.env.NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402 === "true" && <NetworkSelector />}
                <HowItWorksButton />
              </>
            }
          />

          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {showConnectionBanner && (
                  <div className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 sm:mx-6">
                    {connectionBannerMessage}
                  </div>
                )}
                {hasMessages ? (
                  <ChatArea
                    messages={messages}
                    isLoading={isLoading}
                    loadingHint={chatLoadingHint}
                    onRetrySend={handleRetrySend}
                    mobileTerminal={
                      showTerminal ? (
                        <div className="md:hidden">
                          <MobileTerminalCollapsible
                            logs={terminalLogs}
                            showReceipt={!!terminalReceipt}
                            receipt={terminalReceipt}
                            isLoading={isLoading}
                            isRevealing={terminalIsRevealing}
                          />
                        </div>
                      ) : null
                    }
                  />
                ) : (
                  <EmptyState onQuestionClick={handleSend} />
                )}
              </div>
              {directSubnetPanel ? (
                <DirectSubnetFields
                  spec={directSubnetPanel.spec}
                  loading={directSubnetPanel.loading}
                  error={directSubnetPanel.error}
                  endpointPath={directSubnetPanel.endpointPath}
                  onEndpointPath={(p) => directSubnetPanel.setEndpointPath(p)}
                  model={directSubnetPanel.model}
                  onModel={(v) => directSubnetPanel.setModel(v)}
                  modelPlaceholder={directSubnetPanel.modelPlaceholder}
                  imageUrl={directSubnetPanel.imageUrl}
                  onImageUrl={(v) => directSubnetPanel.setImageUrl(v)}
                  lat={directSubnetPanel.lat}
                  onLat={(v) => directSubnetPanel.setLat(v)}
                  lon={directSubnetPanel.lon}
                  onLon={(v) => directSubnetPanel.setLon(v)}
                  gateError={directSubnetPanel.gateError}
                />
              ) : null}
              <ChatInput
                onSend={(text) => {
                  const blocked =
                    (!isSubnetMode && anonAiExhausted) ||
                    (isSubnetMode && authState !== "ready" && (authState !== "unauthenticated" || anonExhausted));
                  if (blocked) {
                    setWalletPromptOpen(true);
                    return;
                  }
                  handleSend(text);
                }}
                disabled={isLoading}
                allowEmptySend={Boolean(
                  directSubnetPanel?.imageUrl.trim() ||
                    (directSubnetPanel?.lat.trim() && directSubnetPanel?.lon.trim()),
                )}
              />
            </div>

            {showTerminal && (
              <div className="hidden md:flex">
                <TerminalPanel
                  logs={terminalLogs}
                  showReceipt={!!terminalReceipt}
                  receipt={terminalReceipt}
                  isRevealing={terminalIsRevealing}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
