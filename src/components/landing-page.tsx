"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/*
  Mobile  (<md): vertical scrollable list of full-width cards
  Desktop (≥md): 2×2 cross-quadrant layout (original design)
*/

const QUADRANTS = [
  {
    key: "terminal",
    lines: ["VERIFIED", "CHATBOT"],
    sub: "Open-Source Powered",
    who: "Analysts, researchers, and individuals who need quick, verified answers.",
    value: "Get trustworthy answers instantly, without building or maintaining your own AI systems.",
    cta: "Open Terminal →",
    href: "/intelligence-terminal",
    isTop: true,
    groupPos: "bottom-10 right-10",
    groupAlign: "items-end",
    textAlign: "text-right",
    bracketPos: "top-5 left-5",
    bracketCorner: "tl" as const,
    titleMask: "linear-gradient(to bottom right, black 35%, rgba(0,0,0,0.65) 100%)",
    glowBg: "radial-gradient(ellipse 70% 70% at 100% 100%, rgba(251,191,36,0.13), transparent 70%)",
    accentColor: "rgba(251,191,36,0.18)",
  },
  {
    key: "api",
    lines: ["DEVELOPER", "APIs"],
    sub: "Direct Access",
    who: "Software engineers, quants, and developers building applications.",
    value: "Build smarter apps and trading systems connected directly to verified machine intelligence.",
    cta: "View Docs →",
    href: "https://docs.telegraphprotocol.com",
    isTop: true,
    groupPos: "bottom-10 left-10",
    groupAlign: "items-start",
    textAlign: "text-left",
    bracketPos: "top-5 right-5",
    bracketCorner: "tr" as const,
    titleMask: "linear-gradient(to bottom left, black 35%, rgba(0,0,0,0.65) 100%)",
    glowBg: "radial-gradient(ellipse 70% 70% at 0% 100%, rgba(96,165,250,0.13), transparent 70%)",
    accentColor: "rgba(96,165,250,0.18)",
  },
  {
    key: "streams",
    lines: ["ENTERPRISE", "STREAMS"],
    sub: "Automated Signals",
    who: "Hedge funds, enterprises, and teams running autonomous systems.",
    value: "Power your bots and agents with reliable, tamper-proof intelligence.",
    cta: "Open Dashboard →",
    href: "/dashboard",
    isTop: false,
    groupPos: "top-10 right-10",
    groupAlign: "items-end",
    textAlign: "text-right",
    bracketPos: "bottom-5 left-5",
    bracketCorner: "bl" as const,
    titleMask: "linear-gradient(to top right, black 35%, rgba(0,0,0,0.65) 100%)",
    glowBg: "radial-gradient(ellipse 70% 70% at 100% 0%, rgba(167,139,250,0.13), transparent 70%)",
    accentColor: "rgba(167,139,250,0.18)",
  },
  {
    key: "miners",
    lines: ["SUPPLY THE", "NETWORK"],
    sub: "For Miners",
    who: "AI labs, miners, and companies with trained models.",
    value: "Connect your models and start earning by serving real demand from automated systems globally.",
    cta: "Integrate Now →",
    href: "https://integrate.telegraphprotocol.com",
    isTop: false,
    groupPos: "top-10 left-10",
    groupAlign: "items-start",
    textAlign: "text-left",
    bracketPos: "bottom-5 right-5",
    bracketCorner: "br" as const,
    titleMask: "linear-gradient(to top left, black 35%, rgba(0,0,0,0.65) 100%)",
    glowBg: "radial-gradient(ellipse 70% 70% at 0% 0%, rgba(52,211,153,0.13), transparent 70%)",
    accentColor: "rgba(52,211,153,0.18)",
  },
] as const;

const CONTACT_HREF = "mailto:team@telegraphprotocol.com";

function CornerBracket({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const tl = corner === "tl", tr = corner === "tr", bl = corner === "bl";
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-foreground/35">
      <line x1={tl || bl ? 0 : 14} y1={tl || tr ? 0 : 14} x2={tl || bl ? 0 : 14} y2={tl || tr ? 8 : 6} stroke="currentColor" strokeWidth="1.2" />
      <line x1={tl || bl ? 0 : 14} y1={tl || tr ? 0 : 14} x2={tl || bl ? 8 : 6} y2={tl || tr ? 0 : 14} stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* ── Mobile card ── */
function MobileCard({ q }: { q: typeof QUADRANTS[number] }) {
  const isExternal = q.href.startsWith("http");

  const inner = (
    <div
      className="relative overflow-hidden border-b border-foreground/[0.08] px-6 py-8 active:bg-foreground/[0.03]"
      style={{ background: `radial-gradient(ellipse 60% 80% at 0% 50%, ${q.accentColor}, transparent 70%)` }}
    >
      {/* Corner bracket */}
      <div className="absolute right-4 top-4">
        <CornerBracket corner={q.bracketCorner} />
      </div>

      {/* Sub label */}
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground" style={{ opacity: 0.45 }}>
        {q.sub}
      </p>

      {/* Title */}
      <div className="mb-4 flex flex-col gap-0">
        {q.lines.map((line) => (
          <span
            key={line}
            className="block whitespace-nowrap text-[clamp(32px,9vw,52px)] font-bold uppercase leading-[0.9] tracking-[-0.02em] text-foreground"
            style={{ opacity: 0.90 }}
          >
            {line}
          </span>
        ))}
      </div>

      {/* Who */}
      <p className="mb-2 text-[13px] font-normal leading-relaxed text-foreground" style={{ opacity: 0.75 }}>
        {q.who}
      </p>

      {/* Value */}
      <p className="mb-5 text-[12px] font-light leading-relaxed text-foreground" style={{ opacity: 0.55 }}>
        {q.value}
      </p>

      {/* CTA */}
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground" style={{ opacity: 0.80 }}>
        {q.cta}
      </span>
    </div>
  );

  return isExternal ? (
    <a href={q.href} target="_blank" rel="noopener noreferrer" className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset">
      {inner}
    </a>
  ) : (
    <Link href={q.href} className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset">
      {inner}
    </Link>
  );
}

export function LandingPage() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative h-full bg-background font-mono">
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid" />

      {/* ── Floating nav pill ── */}
      <div className="absolute left-1/2 top-5 z-30 -translate-x-1/2">
        <div className="flex items-center gap-0 border border-foreground/[0.10] bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2 px-4 py-2">
            <img src="/logo.png" alt="Telegraph" className="h-4 w-4 object-contain opacity-75" />
            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-foreground/70">
              Telegraph
            </span>
          </div>
          <div className="h-4 w-px bg-foreground/[0.10]" />
          <div className="px-1 py-1">
            <ThemeToggle />
          </div>
          <div className="h-4 w-px bg-foreground/[0.10]" />
          <a
            href={CONTACT_HREF}
            className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/70 no-underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            Contact Sales
          </a>
        </div>
      </div>

      {/* ════════════════════════════════
          MOBILE layout  (hidden on md+)
      ════════════════════════════════ */}
      <div className="flex h-full flex-col overflow-y-auto md:hidden">
        {/* Spacer so first card clears the nav pill */}
        <div className="shrink-0 pt-20" />

        {QUADRANTS.map((q) => (
          <MobileCard key={q.key} q={q} />
        ))}

        {/* Footer */}
        <div className="flex items-center justify-center gap-6 border-t border-foreground/[0.08] px-6 py-6">
          <a
            href={CONTACT_HREF}
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground no-underline"
            style={{ opacity: 0.50 }}
          >
            Contact Sales
          </a>
          <div className="h-3 w-px bg-foreground/20" />
          <a
            href="https://docs.telegraphprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground no-underline"
            style={{ opacity: 0.50 }}
          >
            Docs
          </a>
          <div className="h-3 w-px bg-foreground/20" />
          <ThemeToggle />
        </div>
      </div>

      {/* ════════════════════════════════
          DESKTOP layout  (hidden below md)
      ════════════════════════════════ */}
      <div className="hidden h-full overflow-hidden md:block">
        {/* Cross lines */}
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-foreground/[0.12]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-foreground/[0.12]" />

        {/* Center logo at intersection */}
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-8 w-8 items-center justify-center border border-foreground/[0.18] bg-background">
            <span className="absolute -left-1 -top-1 h-2 w-2 border-l border-t border-foreground/30" />
            <span className="absolute -right-1 -top-1 h-2 w-2 border-r border-t border-foreground/30" />
            <span className="absolute -bottom-1 -left-1 h-2 w-2 border-b border-l border-foreground/30" />
            <span className="absolute -bottom-1 -right-1 h-2 w-2 border-b border-r border-foreground/30" />
            <img src="/logo.png" alt="" className="h-4 w-4 object-contain opacity-75" />
          </div>
        </div>

        {/* 2×2 quadrant grid */}
        <div className="grid h-full grid-cols-2 grid-rows-2">
          {QUADRANTS.map((q) => {
            const active = hovered === q.key;
            const isExternal = q.href.startsWith("http");

            const quadrant = (
              <div
                className="relative h-full w-full cursor-pointer overflow-hidden"
                onMouseEnter={() => setHovered(q.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(q.key)}
                onBlur={() => setHovered(null)}
              >
                <div
                  className="pointer-events-none absolute inset-0 transition-opacity duration-500"
                  style={{ background: q.glowBg, opacity: active ? 1 : 0 }}
                />
                <div className={`absolute ${q.bracketPos}`}>
                  <CornerBracket corner={q.bracketCorner} />
                </div>
                <div
                  className={`absolute flex flex-col gap-3 ${q.groupPos} ${q.groupAlign} max-w-[300px] transition-transform duration-500 ease-out`}
                  style={{
                    transform: active ? "scale(1.12)" : "scale(1)",
                    transformOrigin: q.isTop
                      ? (q.groupAlign === "items-end" ? "bottom right" : "bottom left")
                      : (q.groupAlign === "items-end" ? "top right" : "top left"),
                  }}
                >
                  {q.isTop && (
                    <div className={`flex flex-col gap-1.5 ${q.groupAlign} ${q.textAlign}`}>
                      <p className="text-[12px] font-normal leading-relaxed text-foreground transition-opacity duration-300" style={{ opacity: active ? 1 : 0.75 }}>
                        {q.who}
                      </p>
                      <p className="text-[11px] font-light leading-relaxed text-foreground transition-opacity duration-300" style={{ opacity: active ? 0.85 : 0.60 }}>
                        {q.value}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground transition-opacity duration-300" style={{ opacity: active ? 1 : 0.70 }}>
                        {q.cta}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex flex-col gap-0.5 ${q.groupAlign} ${q.textAlign}`}
                    style={{ WebkitMaskImage: q.titleMask, maskImage: q.titleMask }}
                  >
                    {q.lines.map((line) => (
                      <span
                        key={line}
                        className="block whitespace-nowrap text-[clamp(30px,4.6vw,72px)] font-bold uppercase leading-[0.9] tracking-[-0.02em] text-foreground transition-opacity duration-300"
                        style={{ opacity: active ? 1 : 0.85 }}
                      >
                        {line}
                      </span>
                    ))}
                    <span
                      className="mt-1.5 block text-[10px] font-bold uppercase tracking-[0.20em] text-foreground transition-opacity duration-300"
                      style={{ opacity: active ? 0.85 : 0.55 }}
                    >
                      {q.sub}
                    </span>
                  </div>
                  {!q.isTop && (
                    <div className={`flex flex-col gap-1.5 ${q.groupAlign} ${q.textAlign}`}>
                      <p className="text-[12px] font-normal leading-relaxed text-foreground transition-opacity duration-300" style={{ opacity: active ? 1 : 0.75 }}>
                        {q.who}
                      </p>
                      <p className="text-[11px] font-light leading-relaxed text-foreground transition-opacity duration-300" style={{ opacity: active ? 0.85 : 0.60 }}>
                        {q.value}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground transition-opacity duration-300" style={{ opacity: active ? 1 : 0.70 }}>
                        {q.cta}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );

            return isExternal ? (
              <a key={q.key} href={q.href} target="_blank" rel="noopener noreferrer" className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset">
                {quadrant}
              </a>
            ) : (
              <Link key={q.key} href={q.href} className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset">
                {quadrant}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
