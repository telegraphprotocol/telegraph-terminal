"use client";

import { Copy } from "lucide-react";
import type { DaemonResultItem } from "@/lib/engine-daemon-types";
import { questionSourceArticleUrl } from "@/lib/kraken-signal-format";

type KrakenSourceWithCopyProps = {
  item: DaemonResultItem;
  /** Compact table/card row (signals feed, alerts strip) */
  variant?: "feed" | "panel";
};

/**
 * Collector source id: clickable https? link when `question.source_url` is set;
 * otherwise plain label. Copy copies the URL when present else the short source name.
 */
export function KrakenSourceWithCopy({ item, variant = "feed" }: KrakenSourceWithCopyProps) {
  const href = questionSourceArticleUrl(item.question);
  const copyText = href ?? item.source;
  const copyLabel = href ? "Copy source URL" : "Copy source name";

  const isFeed = variant === "feed";
  const copyIconSize = isFeed ? 12 : 14;

  const linkClass = isFeed
    ? "min-w-0 truncate text-[11px] text-white/90 font-mono font-semibold tracking-wide uppercase underline-offset-2 hover:text-primary hover:underline"
    : "inline min-w-0 break-all text-sm font-mono font-semibold tracking-wide uppercase underline-offset-2 text-primary hover:underline";

  const spanClass = isFeed
    ? "min-w-0 truncate text-[11px] text-white/90 font-mono font-semibold tracking-wide uppercase"
    : "inline min-w-0 break-all text-sm font-mono font-semibold tracking-wide uppercase text-white/90";

  return (
    <div className="flex min-w-0 items-center gap-1.5 group">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title="Open source in new tab"
          className={linkClass}
          onClick={(e) => e.stopPropagation()}
        >
          {item.source}
        </a>
      ) : (
        <span className={spanClass}>{item.source}</span>
      )}
      <button
        type="button"
        title={copyLabel}
        aria-label={copyLabel}
        className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          void navigator.clipboard.writeText(copyText);
        }}
      >
        <Copy size={copyIconSize} />
      </button>
    </div>
  );
}
