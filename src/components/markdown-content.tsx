"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  return (
    /\*\*[\s\S]*?\*\*/.test(t) ||
    /^#{1,6}\s/m.test(t) ||
    /^(\s{0,3}[-*+])\s/m.test(t) ||
    /^\s*\d+\.\s/m.test(t) ||
    /```[\s\S]*?```/.test(t) ||
    /\[[^\]\n]+\]\([^)\s]+\)/.test(t) ||
    /\n\|[^\n]+\|\s*\n\|[-:| ]+\|/.test(t) ||
    /^>\s/m.test(t) ||
    /\n[-*_]{3,}\s*(\n|$)/.test(t)
  );
}

const baseMarkdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mb-3 mt-1 text-lg font-semibold tracking-tight" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-2 mt-4 text-base font-semibold tracking-tight first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 mt-3 text-[15px] font-semibold" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-3 leading-relaxed last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-3 ml-1 list-disc space-y-1 pl-5 leading-relaxed" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 ml-1 list-decimal space-y-1 pl-5 leading-relaxed" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="marker:text-muted-foreground" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic opacity-95" {...props}>
      {children}
    </em>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-3 border-l-2 border-primary/35 pl-3 text-sm italic text-muted-foreground" {...props}>
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
    <div className="my-3 overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full border-collapse text-left text-[13px]" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/40" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border-b border-border/50 px-3 py-2 font-semibold" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-b border-border/30 px-3 py-2 align-top" {...props}>
      {children}
    </td>
  ),
  tr: (props) => <tr {...props} />,
  tbody: (props) => <tbody {...props} />,
  pre: ({ children, ...props }) => (
    <pre
      className="my-3 overflow-x-auto rounded-lg border border-border/40 bg-muted/30 p-3 font-mono text-[13px] leading-relaxed"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (!isBlock) {
      return (
        <code className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[13px]" {...props}>
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

export const chatMarkdownComponents: Components = {
  ...baseMarkdownComponents,
  h1: ({ children, ...props }) => (
    <h1 className="mb-3 mt-1 text-lg font-semibold tracking-tight text-foreground" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-2 mt-4 text-base font-semibold tracking-tight text-foreground first:mt-0" {...props}>
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
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground/95" {...props}>
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

export const signalMarkdownComponents: Components = {
  ...baseMarkdownComponents,
  h1: ({ children, ...props }) => (
    <h1 className="mb-2 mt-0 text-base font-bold text-white" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-2 mt-3 text-sm font-bold text-white first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-1.5 mt-2 text-sm font-semibold text-white/95" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2.5 text-sm leading-relaxed text-white/90 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2.5 ml-1 list-disc space-y-1 pl-4 text-sm leading-relaxed text-white/90" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-2.5 ml-1 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-white/90" {...props}>
      {children}
    </ol>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-white" {...props}>
      {children}
    </strong>
  ),
};

export type MarkdownContentProps = {
  children: string;
  className?: string;
  variant?: "chat" | "signal";
};

export function MarkdownContent({ children, className, variant = "chat" }: MarkdownContentProps) {
  const components = variant === "signal" ? signalMarkdownComponents : chatMarkdownComponents;
  return (
    <div className={cn("markdown-content min-w-0 break-words", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
