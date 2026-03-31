"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { ChatMessage } from "@/lib/mock-data";

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function ChatArea({ messages, isLoading }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="w-full max-w-[640px] mx-auto px-4 space-y-6">
        {messages.map((message) => (
          <div key={message.id}>
            {message.role === "user" ? (
              /* User message bubble */
              <div className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-tr-sm bg-muted px-4 py-3">
                  {message.content.map((c, i) => (
                    <p
                      key={i}
                      className="text-sm text-foreground leading-relaxed"
                    >
                      {c.text}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              /* Assistant message — plain text, animates in */
              <div className="assistant-message-in max-w-2xl">
                {message.content.map((c, i) => (
                  <p
                    key={i}
                    className="text-sm text-foreground leading-relaxed"
                  >
                    {c.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}

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
