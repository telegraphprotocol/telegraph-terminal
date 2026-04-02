"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Paperclip, ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="pb-4 pt-2 bg-background">
      <div className="w-full max-w-[640px] mx-auto px-4">
        <div className="flex items-center gap-2 rounded-full bg-card px-3 py-2.5 focus-within:border-primary/50 transition-colors">
          <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0 mb-0.5">
            <Paperclip size={16} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Ask Telegraph"
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed max-h-40 overflow-y-auto"
            style={{ height: "24px" }}
          />

          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className="p-1.5 rounded-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground transition-colors shrink-0 mb-0.5"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        {/*
        <p className="text-center text-[10px] text-muted-foreground mt-3">
          Telegraph Intelligence Terminal is an AI model and can make mistakes.
        </p>
        */}
      </div>
    </div>
  );
}
