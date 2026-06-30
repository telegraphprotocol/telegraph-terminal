"use client";

import { Download } from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";

interface GuideOutputProps {
  guide: string;
  onReset: () => void;
}

export function GuideOutput({ guide, onReset }: GuideOutputProps) {
  function handleSavePdf() {
    window.print();
  }

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <p className="text-[11px] uppercase tracking-widest font-bold">Telegraph Protocol</p>
        <h1 className="text-2xl font-bold mt-1">Build with Telegraph — Your Guide</h1>
        <p className="text-sm text-gray-500 mt-1">telegraphprotocol.com · docs.telegraphprotocol.com</p>
        <hr className="mt-4" />
      </div>

      <div className="flex flex-col gap-6">
        <div id="guide-print-area" className="border border-border/40 bg-card/50 p-6 backdrop-blur-sm print:border-none print:bg-white print:p-0 print:shadow-none">
          <MarkdownContent>{guide}</MarkdownContent>
        </div>

        <div className="flex flex-wrap items-center gap-4 print:hidden">
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
    </>
  );
}
