"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/mock-data";
import { looksLikeMarkdown, MarkdownContent } from "@/components/markdown-content";
import { KrakenStructuredResult } from "@/components/kraken/kraken-structured-result";
import { parseExecutionResult } from "@/lib/kraken-signal-result";

function tryParseStructured(text: string): unknown | null {
  const t = text.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export function AssistantMessage({ message }: { message: ChatMessage }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const segments = message.content.map((c) => c.text);
  const fullText = useMemo(() => segments.join("\n\n"), [segments]);

  const structuredData = useMemo(() => tryParseStructured(fullText), [fullText]);
  const structuredResult = useMemo(() => {
    if (!structuredData) return null;
    const parsed = parseExecutionResult(structuredData);
    return parsed.sections.length > 0 ? parsed : null;
  }, [structuredData]);

  const markdownPossible = useMemo(() => !structuredData && looksLikeMarkdown(fullText), [fullText, structuredData]);
  const hasRenderableBody = segments.some((t) => t.length > 0);

  const copyResponse = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [fullText]);

  return (
    <div className="flex items-start gap-4 max-w-2xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border/60 bg-muted p-1">
        <img src="/logo.png" alt="Telegraph" className="h-full w-full object-contain" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="space-y-2">
          {structuredResult && !showRaw ? (
            <KrakenStructuredResult result={structuredData} />
          ) : markdownPossible && !showRaw ? (
            <div className="assistant-markdown">
              {fullText.trim() ? (
                <MarkdownContent variant="chat">{fullText}</MarkdownContent>
              ) : (
                <span className="inline-block h-4 w-1 animate-pulse bg-foreground/60" aria-hidden />
              )}
            </div>
          ) : (
            message.content.map((c, i) => (
              <p
                key={i}
                className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90"
              >
                {c.text}
                {!c.text && (
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-foreground/60" aria-hidden />
                )}
              </p>
            ))
          )}
        </div>

        {hasRenderableBody && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
            {(markdownPossible || structuredResult) && (
              <div
                className="inline-flex rounded-md bg-muted/50 p-0.5 text-[11px] font-medium text-muted-foreground"
                role="group"
                aria-label="Response view"
              >
                <button
                  type="button"
                  onClick={() => setShowRaw(false)}
                  className={cn(
                    "rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !showRaw ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                  )}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setShowRaw(true)}
                  className={cn(
                    "rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    showRaw ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                  )}
                >
                  Raw
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={copyResponse}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={copied ? "Copied" : "Copy response"}
              title={copied ? "Copied" : "Copy response"}
            >
              {copied ? <Check className="size-4 text-success" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={2} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
