"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Paperclip, ArrowUp, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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
    <div className="bg-background/80 pb-[max(2rem,calc(2rem+env(safe-area-inset-bottom,0px)))] pt-4 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6">
        <motion.div 
          animate={{ 
            scale: isFocused ? 1.01 : 1,
            boxShadow: isFocused ? "0 10px 30px -10px rgba(140,89,255,0.2)" : "0 4px 20px -5px rgba(0,0,0,0.1)"
          }}
          className={cn(
            "relative flex items-end gap-2 rounded-[28px] bg-card border-2 p-2 transition-all duration-300",
            isFocused ? "border-primary/40 bg-background shadow-2xl" : "border-border/40"
          )}
        >
          <button className="p-3 rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-300 shrink-0 mb-0.5 group">
            <Paperclip size={20} className="group-hover:rotate-12 transition-transform" />
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
            className="flex-1 max-h-40 min-h-[48px] resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-[15px] font-medium leading-snug text-foreground outline-none placeholder:text-muted-foreground/50 custom-scrollbar sm:py-3"
            style={{ height: "48px" }}
          />

          <AnimatePresence mode="wait">
            {value.trim() ? (
              <motion.button
                key="send-button"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                onClick={handleSend}
                disabled={disabled}
                className="p-3 rounded-2xl bg-gradient-premium text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shrink-0 mb-0.5"
              >
                <ArrowUp size={20} strokeWidth={3} />
              </motion.button>
            ) : (
               <motion.div
                key="idle-icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                className="p-3 rounded-2xl text-muted-foreground shrink-0 mb-0.5"
              >
                <Zap size={20} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-4"
        >
          Secured by Telegraph Neural Network v1.0
        </motion.p>
      </div>
    </div>
  );
}
