"use client";

import { cn } from "@/lib/utils";

export type ProductType = {
  key: string;
  label: string;
  description: string;
  accentColor: string;
};

export const PRODUCT_TYPES: ProductType[] = [
  {
    key: "prediction",
    label: "I want to build a prediction marketplace",
    description: "Signal markets, forecasting platforms, reputation-weighted prediction pools.",
    accentColor: "rgba(251,191,36,0.15)",
  },
  {
    key: "monetize",
    label: "I want my enterprise to monetize its AI model",
    description: "Register your model as a miner, earn per-call revenue via x402 micropayments.",
    accentColor: "rgba(52,211,153,0.15)",
  },
  {
    key: "chatbot",
    label: "I want to build a verified AI chatbot",
    description: "Every response cryptographically proven and paid — no black-box AI.",
    accentColor: "rgba(96,165,250,0.15)",
  },
  {
    key: "streams",
    label: "I want to build automated intelligence streams",
    description: "Autonomous agents and enterprise pipelines powered by verified miner intelligence.",
    accentColor: "rgba(167,139,250,0.15)",
  },
];

interface ProductTypeCardsProps {
  selected: string | null;
  onSelect: (key: string, label: string) => void;
}

export function ProductTypeCards({ selected, onSelect }: ProductTypeCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PRODUCT_TYPES.map((p) => {
        const active = selected === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelect(p.key, p.label)}
            className={cn(
              "group relative overflow-hidden border text-left transition-all duration-200 px-5 py-4",
              active
                ? "border-foreground/60 bg-foreground/5"
                : "border-border/50 hover:border-foreground/30 hover:bg-foreground/[0.02]",
            )}
            style={{ background: active ? p.accentColor : undefined }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: p.accentColor }}
            />
            <p className="relative text-[13px] font-bold text-foreground leading-snug mb-1.5">
              {p.label}
            </p>
            <p className="relative text-[11px] text-muted-foreground leading-relaxed">
              {p.description}
            </p>
            {active && (
              <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-widest text-foreground/60">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
