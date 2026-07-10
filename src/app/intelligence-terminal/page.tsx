"use client";

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ChatArea } from "@/components/chat-area";
import { ChatInput } from "@/components/chat-input";
import { DirectSubnetFields } from "@/components/direct-subnet-fields";
import { endpointNeedsImage } from "@/lib/subnet-direct-spec";
import { EmptyState } from "@/components/empty-state";
import { HowItWorksButton } from "@/components/how-it-works-button";
import { ReceiptHistoryModal } from "@/components/receipt-history-modal";
import { NetworkSelector } from "@/components/network-selector";
import { MobileTerminalCollapsible, TerminalPanel } from "@/components/terminal-panel";
import { ConnectWalletModal } from "@/components/auth/connect-wallet-modal";
import { WalletChoiceModal } from "@/components/auth/wallet-choice-modal";
import { DepositModal } from "@/components/auth/deposit-modal";
import { SolanaDepositModal } from "@/components/auth/solana-deposit-modal";
import { useLiveExecutor } from "@/lib/hooks/use-live-executor";
import { apiClient } from "@/lib/api-client";
import { getToken, authHeaders, AUTH_CHANGED_EVENT } from "@/lib/auth";
import { usePaymentNetwork } from "@/lib/network-context";
import { Receipt } from "lucide-react";
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

  const { network: selectedNetwork } = usePaymentNetwork();

  // Auth state machine
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [depositEvmAddress, setDepositEvmAddress] = useState<string | null>(null);
  const [depositSolanaAddress, setDepositSolanaAddress] = useState<string | null>(null);
  const [walletPromptOpen, setWalletPromptOpen] = useState(false);

  const refreshAuthState = useCallback(() => {
    const token = getToken();
    if (!token) {
      setAuthState("unauthenticated");
      return;
    }
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

  useEffect(() => {
    refreshAuthState();
    const onAuthChanged = () => refreshAuthState();
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
  }, [refreshAuthState]);

  const handleAuthenticated = useCallback(() => {
    setWalletPromptOpen(false);
    refreshAuthState();
  }, [refreshAuthState]);

  const handlePrivyCreated = useCallback((evmAddress: string, solanaAddress: string) => {
    setDepositEvmAddress(evmAddress || null);
    setDepositSolanaAddress(solanaAddress || null);
    setAuthState("deposit");
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
    selectedMsgReceipt,
    selectedMsgLogs,
    handleSelectMessageReceipt,
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

  const [receiptHistoryOpen, setReceiptHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLayoutReady, setSidebarLayoutReady] = useState(false);

  // Active receipt/logs: prefer message-selected over live terminal
  const activeReceipt = selectedMsgReceipt ?? terminalReceipt;
  const activeLogs = selectedMsgLogs.length > 0 ? selectedMsgLogs : terminalLogs;

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

  const subnetPickerProps = {
    subnets: engineSubnets,
    selectedSubnetId: forcedSubnetId,
    onSubnetChange: setForcedSubnetId,
    loading: subnetsLoading,
    error: subnetsError,
  };

  return (
    <>
      {receiptHistoryOpen && <ReceiptHistoryModal onClose={() => setReceiptHistoryOpen(false)} />}

      {/* Auth modals — rendered above everything */}
      {authState === "unauthenticated" && walletPromptOpen && (
        <ConnectWalletModal onAuthenticated={handleAuthenticated} onClose={() => setWalletPromptOpen(false)} />
      )}
      {authState === "wallet-choice" && (
        <WalletChoiceModal
          onPrivyCreated={handlePrivyCreated}
        />
      )}
      {authState === "deposit" && (
        selectedNetwork === "solana" && depositSolanaAddress
          ? <SolanaDepositModal privySolanaAddress={depositSolanaAddress} onClose={handleDepositClose} />
          : depositEvmAddress
            ? <DepositModal walletAddress={depositEvmAddress} onClose={handleDepositClose} />
            : null
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
          subnetPicker={subnetPickerProps}
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
            subnetPicker={subnetPickerProps}
            extraActions={
              <>
                {process.env.NEXT_PUBLIC_USE_TERMINAL_BACKEND_X402 === "true" && <NetworkSelector />}
                <button
                  type="button"
                  onClick={() => setReceiptHistoryOpen(true)}
                  className="inline-flex h-8 shrink-0 items-center gap-1 border border-foreground/50 bg-foreground/10 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground transition-all hover:border-foreground/80 hover:bg-foreground/20 sm:gap-1.5 sm:px-2.5"
                  title="View receipt history"
                >
                  <Receipt className="size-3" strokeWidth={2} />
                  <span className="hidden sm:inline">History</span>
                </button>
                <HowItWorksButton />
              </>
            }
          />

          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {showConnectionBanner && (
                  <div className="mx-4 mb-2 rounded-md border border-red-600/40 bg-red-500/8 px-3 py-2 text-xs text-red-700 dark:border-red-500/25 dark:text-red-400/90 sm:mx-6">
                    {connectionBannerMessage}
                  </div>
                )}
                {hasMessages ? (
                  <ChatArea
                    messages={messages}
                    isLoading={isLoading}
                    loadingHint={chatLoadingHint}
                    onRetrySend={handleRetrySend}
                    onShowMessageReceipt={handleSelectMessageReceipt}
                    mobileTerminal={
                      showTerminal ? (
                        <div className="md:hidden">
                          <MobileTerminalCollapsible
                            logs={activeLogs}
                            showReceipt={!!activeReceipt}
                            receipt={activeReceipt}
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
              {directSubnetPanel ? <DirectSubnetFields {...directSubnetPanel} /> : null}
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
                onAttachImage={
                  directSubnetPanel && endpointNeedsImage(directSubnetPanel.spec, directSubnetPanel.endpointPath)
                    ? directSubnetPanel.onImageUrl
                    : undefined
                }
              />
            </div>

            {showTerminal && (
              <div className="hidden md:flex">
                <TerminalPanel
                  logs={activeLogs}
                  showReceipt={!!activeReceipt}
                  receipt={activeReceipt}
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
