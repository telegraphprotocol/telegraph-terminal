"use client";

import { Download } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";

interface GuideOutputProps {
  guide: string;
  onReset: () => void;
}

export function GuideOutput({ guide, onReset }: GuideOutputProps) {
  function handleSavePdf() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    // Convert markdown to HTML via the already-rendered DOM node
    const el = document.getElementById("guide-print-area");
    const bodyHtml = el ? el.innerHTML : `<pre>${guide}</pre>`;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Build with Telegraph — Your Guide</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.7; color: #111; background: #fff; padding: 48px 56px; max-width: 860px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 700; margin: 28px 0 8px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    h3 { font-size: 13px; font-weight: 700; margin: 18px 0 6px; }
    p { margin-bottom: 10px; }
    ul, ol { margin: 8px 0 10px 20px; }
    li { margin-bottom: 4px; }
    code { background: #f3f3f3; padding: 1px 5px; font-size: 12px; }
    pre { background: #f3f3f3; padding: 14px; overflow-x: auto; margin: 12px 0; font-size: 11.5px; line-height: 1.5; }
    pre code { background: none; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th { background: #f3f3f3; font-weight: 700; text-align: left; padding: 6px 10px; border: 1px solid #ddd; }
    td { padding: 6px 10px; border: 1px solid #ddd; }
    a { color: #111; }
    strong { font-weight: 700; }
    .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 32px; }
    .header-sub { font-size: 11px; color: #666; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.12em; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#666;margin-bottom:6px">Telegraph Protocol</div>
    <h1>Build with Telegraph — Your Guide</h1>
    <div class="header-sub">telegraphprotocol.com &nbsp;·&nbsp; docs.telegraphprotocol.com &nbsp;·&nbsp; integrate.telegraphprotocol.com</div>
  </div>
  ${bodyHtml}
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  return (
    <div className="flex flex-col gap-6">
      <div id="guide-print-area" className="border border-border/40 bg-card/50 p-6 backdrop-blur-sm">
        <MarkdownContent>{guide}</MarkdownContent>
      </div>

      <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onReset}
            className="border border-border/60 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            ← Start Over
          </button>
          <button
            type="button"
            onClick={handleSavePdf}
            className="inline-flex items-center gap-2 border border-foreground/50 bg-foreground/10 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground/20 hover:border-foreground/80"
          >
            <Download size={12} />
            Save as PDF
          </button>
          <a
            href="https://integrate.telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border/50 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            Register a Miner →
          </a>
          <a
            href="https://docs.telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Full Docs ↗
          </a>
      </div>
    </div>
  );
}
