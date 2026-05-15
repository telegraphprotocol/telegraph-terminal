"use client";

import { useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Check, Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/mock-data";

function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  return (
    /\*\*[\s\S]*?\*\*/.test(t) ||
    /^#{1,6}\s/m.test(t) ||
    /^(\s{0,3}[-*+])\s/m.test(t) ||
    /^\s*\d+\.\s/m.test(t) || // numbered lists (any line)
    /```[\s\S]*?```/.test(t) ||
    /\[[^\]\n]+\]\([^)\s]+\)/.test(t) ||
    /\n\|[^\n]+\|\s*\n\|[-:| ]+\|/.test(t) ||
    /^>\s/m.test(t) ||
    /\n[-*_]{3,}\s*(\n|$)/.test(t)
  );
}

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1
      className="mb-3 mt-1 text-lg font-semibold tracking-tight text-foreground"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mb-2 mt-4 text-base font-semibold tracking-tight text-foreground first:mt-0"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 mt-3 text-[15px] font-semibold text-foreground" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-3 text-[15px] leading-relaxed text-foreground/90 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-3 ml-1 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-foreground/90" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 ml-1 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-foreground/90" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="marker:text-muted-foreground" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-foreground" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic text-foreground/95" {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-3 border-l-2 border-primary/35 pl-3 text-[14px] italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="my-4 border-border" {...props} />,
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[13px] text-foreground/90" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/60 text-foreground" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border-b border-border px-3 py-2 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-border/70 px-3 py-2 align-top" {...props}>
      {children}
    </td>
  ),
  tr: (props) => <tr {...props} />,
  tbody: (props) => <tbody {...props} />,
  pre: ({ children, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[13px] leading-relaxed text-foreground/95"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (!isBlock) {
      return (
        <code
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground/95"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("font-mono text-[13px]", className)} {...props}>
        {children}
      </code>
    );
  },
};

export function AssistantMessage({ message }: { message: ChatMessage }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const segments = message.content.map((c) => c.text);
  const fullText = useMemo(() => segments.join("\n\n"), [segments]);

  const markdownPossible = useMemo(() => looksLikeMarkdown(fullText), [fullText]);
  const hasRenderableBody = segments.some((t) => t.length > 0);

  const copyResponse = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [fullText]);

  return (
    <div className="flex items-start gap-4 max-w-2xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-premium shadow-lg shadow-primary/20">
        <Sparkles size={14} className="text-white" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="space-y-2">
          {markdownPossible && !showRaw ? (
            <div className="assistant-markdown">
              {fullText.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {fullText}
                </ReactMarkdown>
              ) : (
                <span className="inline-block h-4 w-1 animate-pulse bg-primary" aria-hidden />
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
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-primary" aria-hidden />
                )}
              </p>
            ))
          )}
        </div>

        {hasRenderableBody && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
            {markdownPossible && (
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
