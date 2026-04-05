"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ChatMessage } from "@/lib/mock-data";

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  /** Shown on small screens between the latest user bubble and assistant content */
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
    <div key={message.id}>
      {message.role === "user" ? (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-muted px-4 py-3 sm:max-w-[70%]">
            {message.content.map((c, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-foreground"
              >
                {c.text}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="assistant-message-in max-w-2xl">
          {message.content.map((c, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-foreground"
            >
              {c.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="mx-auto w-full max-w-[640px] space-y-6 px-4">
        {lastUserIdx >= 0 ? (
          <>
            {messages.slice(0, lastUserIdx + 1).map(renderMessage)}
            {mobileTerminal}
            {messages.slice(lastUserIdx + 1).map(renderMessage)}
          </>
        ) : (
          <>
            {messages.map(renderMessage)}
            {mobileTerminal}
          </>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground max-w-2xl">
            <Loader2 size={18} className="animate-spin text-primary" />
            <span className="text-sm">Reasoning through the steps…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
