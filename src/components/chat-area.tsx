"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { ChatMessage } from "@/lib/mock-data";
import { AssistantMessage } from "@/components/assistant-message";
import { motion, AnimatePresence } from "framer-motion";

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  /** Shown under the spinner while waiting (e.g. x402 payment in progress). */
  loadingHint?: string;
  mobileTerminal?: ReactNode;
  /** Retry a user message that failed to send (x402 / engine). */
  onRetrySend?: (messageId: string) => void;
}

/** True while waiting for an assistant message after the latest user turn. */
function awaitingAssistantAfterLastUser(messages: ChatMessage[], isLoading: boolean): boolean {
  if (!isLoading) return false;
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx < 0) return true;
  for (let j = lastUserIdx + 1; j < messages.length; j++) {
    if (messages[j].role === "assistant") return false;
  }
  return true;
}

export function ChatArea({
  messages,
  isLoading,
  loadingHint,
  mobileTerminal,
  onRetrySend,
}: ChatAreaProps) {
  const scrollRootRef = useRef<HTMLDivElement>(null);

  /** Pin to bottom on the scroll container (avoids `scrollIntoView` smooth + loader unmount jitter). */
  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.scrollTop = root.scrollHeight;
      });
    });
    return () => cancelAnimationFrame(t);
  }, [messages, isLoading]);

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  const renderMessage = (message: ChatMessage) => {
    const failed = message.role === "user" && message.sendState === "failed";
    return (
    <motion.div 
      key={message.id}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {message.role === "user" ? (
        <div className="flex flex-col items-end gap-1.5">
          <div
            className={
              failed
                ? "max-w-[440px] w-fit rounded-2xl border border-red-500/50 bg-red-50 dark:bg-red-950/35 dark:border-red-500/45 px-4 py-[15px] sm:max-w-[min(440px,85%)]"
                : "max-w-[440px] w-fit rounded-2xl bg-secondary px-4 py-[15px] sm:max-w-[min(440px,85%)]"
            }
          >
            {message.content.map((c, i) => (
              <p
                key={i}
                className={
                  failed
                    ? "text-[14px] font-normal leading-[150%] text-red-800 dark:text-red-100"
                    : "text-[14px] font-normal leading-[150%] text-secondary-foreground"
                }
              >
                {c.text}
              </p>
            ))}
            {failed && message.sendError ? (
              <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-red-700 dark:text-red-300/90">
                {message.sendError}
              </p>
            ) : null}
          </div>
          {failed && onRetrySend ? (
            <button
              type="button"
              onClick={() => onRetrySend(message.id)}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300/90 transition-colors hover:bg-red-500/15 hover:text-red-800 dark:hover:text-red-200 disabled:pointer-events-none disabled:opacity-40"
              aria-label="Retry send"
            >
              <RefreshCw size={14} strokeWidth={2.25} aria-hidden />
              <span>Retry</span>
            </button>
          ) : null}
        </div>
      ) : (
        <AssistantMessage message={message} />
      )}
    </motion.div>
    );
  };

  return (
    <div
      ref={scrollRootRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-8 custom-scrollbar [scrollbar-gutter:stable]"
    >
      <div className="mx-auto w-full max-w-[720px] space-y-8 px-6">
        <AnimatePresence mode="sync">
          {lastUserIdx >= 0 ? (
            <Fragment key="chat-split">
              {messages.slice(0, lastUserIdx + 1).map(renderMessage)}
              <div key="mobile-terminal" className="my-4">
                {mobileTerminal}
              </div>
              {messages.slice(lastUserIdx + 1).map(renderMessage)}
            </Fragment>
          ) : (
            <Fragment key="chat-empty">
              {messages.map(renderMessage)}
              <div key="mobile-terminal-empty" className="my-4">
                {mobileTerminal}
              </div>
            </Fragment>
          )}

          {/* Loading indicator */}
          {awaitingAssistantAfterLastUser(messages, Boolean(isLoading)) && (
            <motion.div
              key="subnet-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex max-w-[640px] items-start gap-4"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl">
                <Loader2
                  className="size-4 text-muted-foreground animate-spin"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1 pt-2">
                <p className="text-[14px] font-normal leading-[150%] text-muted-foreground">
                  {loadingHint ?? "Reasoning through the steps..."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
