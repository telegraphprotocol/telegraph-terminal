"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ChatMessage } from "@/lib/mock-data";
import { AssistantMessage } from "@/components/assistant-message";
import { motion, AnimatePresence } from "framer-motion";

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  mobileTerminal?: ReactNode;
}

export function ChatArea({
  messages,
  isLoading,
  mobileTerminal,
}: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  const renderMessage = (message: ChatMessage) => (
    <motion.div 
      key={message.id}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {message.role === "user" ? (
        <div className="flex justify-end">
          <div className="max-w-[440px] w-fit rounded-2xl bg-[#282636] px-4 py-[15px] sm:max-w-[min(440px,85%)]">
            {message.content.map((c, i) => (
              <p
                key={i}
                className="text-[14px] font-normal leading-[150%] text-white"
              >
                {c.text}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <AssistantMessage message={message} />
      )}
    </motion.div>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-8 custom-scrollbar">
      <div className="mx-auto w-full max-w-[720px] space-y-8 px-6">
        <AnimatePresence mode="popLayout">
          {lastUserIdx >= 0 ? (
            <Fragment key="chat-split">
              {messages.slice(0, lastUserIdx + 1).map(renderMessage)}
              <motion.div
                key="mobile-terminal"
                layout
                className="my-4"
              >
                {mobileTerminal}
              </motion.div>
              {messages.slice(lastUserIdx + 1).map(renderMessage)}
            </Fragment>
          ) : (
            <Fragment key="chat-empty">
              {messages.map(renderMessage)}
              <motion.div
                key="mobile-terminal-empty"
                layout
                className="my-4"
              >
                {mobileTerminal}
              </motion.div>
            </Fragment>
          )}

          {/* Loading indicator */}
          {isLoading &&
            !messages.some(
              (m) =>
                m.role === "assistant" &&
                (m.id.includes("assistant") || m.id.includes("live-error")),
            ) && (
            <motion.div
              key="subnet-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex max-w-[640px] items-start gap-4"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl">
                <Loader2
                  className="size-4 text-primary animate-spin"
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1 pt-2">
                <p className="text-[14px] font-normal leading-[150%] text-[#9597AC]">
                  Reasoning through the steps...
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
