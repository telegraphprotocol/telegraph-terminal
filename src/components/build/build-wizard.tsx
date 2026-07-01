"use client";

import { useState } from "react";
import { GuideOutput } from "./guide-output";

type Step = "select" | "loading" | "result";

const PERSONA_EXAMPLES = [
  "Hedge fund", "Agricultural investor", "TradFi bank", "AI startup",
  "Enterprise CTO", "Quant researcher", "Government agency", "NGO",
];

export function BuildWizard() {
  const [step, setStep] = useState<Step>("select");
  const [productType, setProductType] = useState("");
  const [customIdea, setCustomIdea] = useState("");
  const [whoAreYou, setWhoAreYou] = useState("");
  const [vision, setVision] = useState("");
  const [guide, setGuide] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCustomIdea(val: string) {
    setCustomIdea(val);
    setProductType(val.trim());
  }

  const canGenerate = customIdea.trim().length > 0;

  async function handleGenerate() {
    const finalProductType = customIdea.trim() || productType;
    if (!finalProductType) return;
    setError(null);
    setStep("loading");
    try {
      const res = await fetch("/api/build/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: finalProductType,
          whoAreYou: whoAreYou.trim() || undefined,
          vision: vision.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to generate guide");
      setGuide(data.guide ?? "");
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("select");
    }
  }

  function reset() {
    setStep("select");
    setProductType("");
    setCustomIdea("");

    setWhoAreYou("");
    setVision("");
    setGuide("");
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">

      {step === "select" && (
        <div className="flex flex-col gap-8">

          {/* I'm a: free text */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
              I'm a…
            </label>
            <input
              type="text"
              value={whoAreYou}
              onChange={(e) => setWhoAreYou(e.target.value)}
              placeholder="Type your role or organisation — quant fund, commodities desk, agri-tech startup…"
              className="w-full border border-foreground/30 bg-foreground/[0.03] px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/70 focus:bg-foreground/[0.05] transition-colors ring-0"
            />
            {/* Example chips */}
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {PERSONA_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setWhoAreYou(ex)}
                  className="border border-border/40 px-2.5 py-1 text-[10px] text-muted-foreground/70 hover:border-foreground/30 hover:text-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* What are you building */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
              What do you want to build?
            </label>
            <textarea
              value={customIdea}
              onChange={(e) => handleCustomIdea(e.target.value)}
              rows={3}
              placeholder="Describe your idea — e.g. a real-time signal terminal tracking oil prices, flight disruptions, and geopolitical events across the Middle East…"
              className="border border-foreground/30 bg-foreground/[0.03] px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/70 focus:bg-foreground/[0.05] transition-colors resize-none"
            />
          </div>

          {/* Vision */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/70">
              Anything else we should know? <span className="normal-case tracking-normal font-normal text-muted-foreground/40">(optional)</span>
            </label>
            <textarea
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              rows={2}
              placeholder="Any context that helps — scale, latency requirements, data sources, internal systems, budget range…"
              className="border border-foreground/30 bg-foreground/[0.03] px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/70 focus:bg-foreground/[0.05] transition-colors resize-none"
            />
          </div>

          {error && (
            <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="border border-foreground/70 bg-foreground/10 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground/20 hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Generate my guide →
            </button>
            <a
              href="https://docs.telegraphprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Skip → go straight to Docs ↗
            </a>
          </div>
        </div>
      )}

      {step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 w-1.5 bg-foreground/60 animate-pulse"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </div>
          <p className="text-[12px] font-medium text-muted-foreground">
            Searching miners, pricing intelligence, and building your guide…
          </p>
          <p className="text-[10px] text-muted-foreground/50">This takes 30 seconds to 1 minute</p>
        </div>
      )}

      {step === "result" && (
        <GuideOutput guide={guide} onReset={reset} />
      )}
    </div>
  );
}
