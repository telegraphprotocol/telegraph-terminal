"use client";

import { useState } from "react";
import { ProductTypeCards } from "./product-type-cards";
import { GuideOutput } from "./guide-output";
import { cn } from "@/lib/utils";

type Step = "select" | "context" | "loading" | "result";

const WHO_OPTIONS = ["Developer / Engineer", "Enterprise / Company", "Researcher", "Founder / Builder", "Other"];

export function BuildWizard() {
  const [step, setStep] = useState<Step>("select");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [productType, setProductType] = useState("");
  const [customIdea, setCustomIdea] = useState("");
  const [whoAreYou, setWhoAreYou] = useState("");
  const [aim, setAim] = useState("");
  const [vision, setVision] = useState("");
  const [guide, setGuide] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handlePresetSelect(key: string, label: string) {
    setSelectedKey(key);
    setProductType(label);
    setCustomIdea("");
    // slight delay so user sees the card highlight before advancing
    setTimeout(() => setStep("context"), 150);
  }

  function handleCustomSubmit() {
    if (!customIdea.trim()) return;
    setSelectedKey(null);
    setProductType(customIdea.trim());
    setStep("context");
  }

  async function handleGenerate() {
    setError(null);
    setStep("loading");
    try {
      const res = await fetch("/api/build/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          whoAreYou: whoAreYou || undefined,
          aim: aim || undefined,
          vision: vision || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to generate guide");
      setGuide(data.guide ?? "");
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("context");
    }
  }

  function reset() {
    setStep("select");
    setSelectedKey(null);
    setProductType("");
    setCustomIdea("");
    setWhoAreYou("");
    setAim("");
    setVision("");
    setGuide("");
    setError(null);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Step: select product type */}
      {step === "select" && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              What are you building?
            </p>
            <ProductTypeCards selected={selectedKey} onSelect={handlePresetSelect} />
          </div>

          {/* Custom idea input */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
              Or describe your own idea
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customIdea}
                onChange={(e) => setCustomIdea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder="e.g. I want to build an autonomous trading bot…"
                className="flex-1 border border-border/50 bg-transparent px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/40 transition-colors"
              />
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customIdea.trim()}
                className="border border-foreground/50 bg-foreground/10 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: context questions */}
      {step === "context" && (
        <div className="flex flex-col gap-6">
          <div className="border border-border/40 bg-foreground/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium mb-0.5">Building</p>
            <p className="text-[13px] font-medium text-foreground">{productType}</p>
            <button
              type="button"
              onClick={() => setStep("select")}
              className="mt-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2"
            >
              Change
            </button>
          </div>

          {error && (
            <div className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-[12px] text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Who are you? <span className="text-muted-foreground/40 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {WHO_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setWhoAreYou(whoAreYou === opt ? "" : opt)}
                    className={cn(
                      "border px-3 py-1.5 text-[11px] font-medium transition-all",
                      whoAreYou === opt
                        ? "border-foreground/60 bg-foreground/10 text-foreground"
                        : "border-border/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                What's your main aim? <span className="text-muted-foreground/40 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={aim}
                onChange={(e) => setAim(e.target.value)}
                placeholder="e.g. Launch a beta in 3 months, integrate into existing SaaS…"
                className="border border-border/50 bg-transparent px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/40 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Describe your vision <span className="text-muted-foreground/40 normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                rows={3}
                placeholder="What does success look like? What problem are you solving?"
                className="border border-border/50 bg-transparent px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/40 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleGenerate}
              className="border border-foreground/70 bg-foreground/10 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground/20 hover:border-foreground"
            >
              Generate my guide →
            </button>
            <a
              href="https://docs.telegraphprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Skip → go straight to Docs ↗
            </a>
          </div>
        </div>
      )}

      {/* Step: loading */}
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
            Querying miners and building your guide…
          </p>
          <p className="text-[10px] text-muted-foreground/50">This takes ~10 seconds</p>
        </div>
      )}

      {/* Step: result */}
      {step === "result" && (
        <GuideOutput guide={guide} onReset={reset} />
      )}
    </div>
  );
}
