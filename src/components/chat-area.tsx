"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2, Sparkles, Brain } from "lucide-react";
import { ChatMessage } from "@/lib/mock-data";
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
          <div className="max-w-[85%] rounded-3xl rounded-tr-sm bg-primary/10 border border-primary/20 px-5 py-3.5 sm:max-w-[70%] shadow-sm">
            {message.content.map((c, i) => (
              <p
                key={i}
                className="text-[14px] font-medium leading-relaxed text-foreground/90"
              >
                {c.text}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 max-w-2xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-premium flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
            <Sparkles size={14} className="text-white" />
          </div>
          <div className="flex-1 space-y-2 pt-1">
             {message.content.map((c, i) => (
              <p
                key={i}
                className="text-[15px] leading-relaxed text-foreground/90"
              >
                {c.text}
                {!c.text && <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5" />}
              </p>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-8 custom-scrollbar">
      <div className="mx-auto w-full max-w-[720px] space-y-8 px-6">
        <AnimatePresence mode="popLayout">
          {lastUserIdx >= 0 ? (
            <>
              {messages.slice(0, lastUserIdx + 1).map(renderMessage)}
              <motion.div 
                key="mobile-terminal"
                layout
                className="my-4"
              >
                {mobileTerminal}
              </motion.div>
              {messages.slice(lastUserIdx + 1).map(renderMessage)}
            </>
          ) : (
            <>
              {messages.map(renderMessage)}
              <motion.div 
                key="mobile-terminal-empty"
                layout
                className="my-4"
              >
                {mobileTerminal}
              </motion.div>
            </>
          )}

          {/* Loading indicator */}
          {isLoading && !messages.some(m => m.role === 'assistant' && m.id.includes('assistant')) && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-muted-foreground/80 max-w-2xl pl-12"
            >
              <div className="relative">
                 <Brain size={18} className="text-primary/60 animate-pulse" />
                 <div className="absolute -inset-1 bg-primary/20 blur-md rounded-full -z-10" />
              </div>
              <span className="text-[13px] font-semibold tracking-tight uppercase tracking-widest opacity-60">Consulting neural subnets...</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
