"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Paperclip, ArrowUp, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, readImageFileAsDataUrl } from "@/lib/utils";

interface ChatInputProps {
  onSend?: (message: string) => void;
  disabled?: boolean;
  allowEmptySend?: boolean;
  /** Present only when the selected miner accepts an image payload (e.g. BitMind). */
  onAttachImage?: (dataUrl: string) => void;
}

export function ChatInput({ onSend, disabled, allowEmptySend = false, onAttachImage }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);

  const handleFileSelect = (file: File | undefined | null) => {
    if (!file || !onAttachImage) return;
    setAttachError(null);
    readImageFileAsDataUrl(file)
      .then(onAttachImage)
      .catch((err: Error) => setAttachError(err.message));
  };

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
    <div className="pb-[max(2rem,calc(2rem+env(safe-area-inset-bottom,0px)))] pt-4">
      <div className="mx-auto w-full max-w-[720px] px-4 sm:px-6">
        <motion.div
          animate={{
            scale: isFocused ? 1.005 : 1,
          }}
          className={cn(
            "relative flex items-end gap-2 border bg-secondary p-2 shadow-sm transition-all duration-300",
            isFocused ? "border-primary/50 shadow-md" : "border-border",
          )}
        >
          {onAttachImage ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-muted-foreground shrink-0 mb-0.5 transition-colors hover:text-foreground"
                aria-label="Attach an image"
                title="Attach an image"
              >
                <Paperclip size={20} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                className="hidden"
              />
            </>
          ) : null}

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Query miners or execute protocols..."
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

        {attachError ? (
          <p className="mt-1.5 text-center text-[11px] text-red-600 dark:text-red-400">{attachError}</p>
        ) : null}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-[10px] font-mono font-medium text-foreground/60 uppercase tracking-[0.25em] mt-4"
        >
          Telegraph Intelligence Terminal
        </motion.p>
      </div>
    </div>
  );
}
