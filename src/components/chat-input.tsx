"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Paperclip, ArrowUp, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
  allowEmptySend?: boolean;
}

export function ChatInput({ onSend, disabled, allowEmptySend = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (disabled) return;
    const trimmed = value.trim();
    if (!trimmed && !allowEmptySend) return;
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
    <div className="bg-background/90 pb-[max(2rem,calc(2rem+env(safe-area-inset-bottom,0px)))] pt-4 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6">
        <motion.div
          animate={{
            scale: isFocused ? 1.005 : 1,
          }}
          className={cn(
            "relative flex items-end gap-2 bg-card border p-2 transition-all duration-300",
            isFocused ? "border-foreground/20" : "border-border/50",
          )}
        >
          <button className="p-3 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all duration-200 shrink-0 mb-0.5">
            <Paperclip size={20} />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Query subnets or execute protocols..."
            disabled={disabled}
            className="flex-1 max-h-40 min-h-[48px] resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-[14px] font-mono leading-snug text-foreground outline-none placeholder:text-muted-foreground/40 custom-scrollbar sm:py-3"
            style={{ height: "48px" }}
          />

          <AnimatePresence mode="wait">
            {value.trim() || allowEmptySend ? (
              <motion.button
                key="send-button"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={handleSend}
                disabled={disabled}
                className="p-3 bg-foreground text-background hover:bg-foreground/90 active:scale-95 disabled:opacity-40 transition-all shrink-0 mb-0.5"
              >
                <ArrowUp size={20} strokeWidth={3} />
              </motion.button>
            ) : (
              <motion.div
                key="idle-icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.25 }}
                className="p-3 text-muted-foreground shrink-0 mb-0.5"
              >
                <Zap size={20} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-[0.25em] mt-4"
        >
          Telegraph Intelligence Terminal
        </motion.p>
      </div>
    </div>
  );
}
