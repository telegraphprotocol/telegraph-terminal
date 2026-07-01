import { BuildWizard } from "@/components/build/build-wizard";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default function BuildPage() {
  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-background font-mono">
      {/* Dot grid background */}
      <div className="pointer-events-none fixed inset-0 bg-dot-grid" />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-[14px]">
        <div className="flex h-14 items-center gap-4 px-5">
          <Link
            href="/"
            className="flex h-7 items-center gap-1.5 border border-foreground/40 bg-foreground/8 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-foreground/70 hover:bg-foreground/15"
          >
            ← Back
          </Link>

          <div className="flex flex-1 items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/80">
              Telegraph
            </span>
            <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/50">
              / Build
            </span>
          </div>

          <a
            href="https://docs.telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            Docs ↗
          </a>
          <ThemeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="relative mx-auto max-w-4xl px-5 py-12">
        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-[clamp(28px,5vw,44px)] font-bold uppercase leading-[0.92] tracking-[-0.02em] text-foreground mb-4">
            Build with
            <br />
            Telegraph
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-lg">
            Tell us what you're building. We'll show you exactly which miners to use, how to integrate x402 payments, and why Telegraph gets you there faster than anything else.
          </p>
          <div className="mt-3">
            <a
              href="https://docs.telegraphprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Skip — go straight to Docs ↗
            </a>
          </div>
        </div>

        <BuildWizard />
      </main>
    </div>
  );
}
