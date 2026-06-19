"use client";

import { ChevronDown } from "lucide-react";
import { useState, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import type { ParsedSubnetYaml, SubnetEndpointSpec } from "@/lib/subnet-direct-spec";

export type DirectSubnetFieldsProps = {
  spec: ParsedSubnetYaml | null;
  loading: boolean;
  error: string | null;
  endpointPath: string | null;
  onEndpointPath: (path: string) => void;
  model: string;
  onModel: (v: string) => void;
  modelPlaceholder: string;
  imageUrl: string;
  onImageUrl: (v: string) => void;
  lat: string;
  onLat: (v: string) => void;
  lon: string;
  onLon: (v: string) => void;
  gateError: string | null;
};

export function DirectSubnetFields({
  spec,
  loading,
  error,
  endpointPath,
  onEndpointPath,
  model,
  onModel,
  modelPlaceholder,
  imageUrl,
  onImageUrl,
  lat,
  onLat,
  lon,
  onLon,
  gateError,
}: DirectSubnetFieldsProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  useLayoutEffect(() => {
    const mq = globalThis.matchMedia("(min-width: 768px)");
    const apply = () => setPanelOpen(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const endpoints: SubnetEndpointSpec[] = spec?.endpoints ?? [];
  const selected = endpoints.find((e) => e.path === endpointPath) ?? null;
  const req = selected?.telegraph_direct?.required_payload_keys ?? [];
  const needsModel = req.includes("model") || selected?.path === "/chat";
  const needsImage = req.includes("image");
  const needsLat = req.includes("lat");
  const needsLon = req.includes("lon");

  return (
    <div className="mx-auto w-full max-w-[720px] min-w-0 px-4 pb-2 sm:px-6">
      <details
        open={panelOpen}
        onToggle={(e) => setPanelOpen((e.target as HTMLDetailsElement).open)}
        className="group rounded-xl border border-border/45 bg-muted/15 px-3 py-2 sm:px-4 sm:py-3"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-1 text-left [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Direct request
          </span>
          <ChevronDown
            size={16}
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="mt-2 space-y-3 pb-1">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">Loading miner YAML…</p>
          ) : null}
          {error ? (
            <p className="break-words text-[12px] text-amber-600 dark:text-amber-400">{error}</p>
          ) : null}
          {gateError ? (
            <p className="break-words text-[12px] text-red-600 dark:text-red-400">{gateError}</p>
          ) : null}

          {spec && endpoints.length > 0 ? (
            <>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Endpoint
                </label>
                {endpoints.length === 1 ? (
                  <p className="min-h-11 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5 text-[14px] leading-snug text-foreground">
                    {endpoints[0].method} {endpoints[0].path}
                  </p>
                ) : (
                  <select
                    value={endpointPath ?? ""}
                    onChange={(e) => onEndpointPath(e.target.value)}
                    className={cn(
                      "min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground shadow-sm outline-none",
                      "focus-visible:ring-2 focus-visible:ring-primary/35",
                    )}
                  >
                    {endpoints.map((e) => (
                      <option key={e.path} value={e.path}>
                        {e.method} {e.path}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {needsModel ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => onModel(e.target.value)}
                    placeholder={modelPlaceholder}
                    autoComplete="off"
                    className={cn(
                      "min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground shadow-sm outline-none",
                      "placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/35",
                    )}
                  />
                </div>
              ) : null}

              {(needsLat || needsLon) ? (
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  {needsLat ? (
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Latitude
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lat}
                        onChange={(e) => onLat(e.target.value)}
                        placeholder="e.g. 40.7"
                        autoComplete="off"
                        className={cn(
                          "min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground shadow-sm outline-none",
                          "placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/35",
                        )}
                      />
                    </div>
                  ) : null}
                  {needsLon ? (
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Longitude
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={lon}
                        onChange={(e) => onLon(e.target.value)}
                        placeholder="e.g. -74.0"
                        autoComplete="off"
                        className={cn(
                          "min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground shadow-sm outline-none",
                          "placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/35",
                        )}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {needsImage ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Image URL or base64
                  </label>
                  <textarea
                    value={imageUrl}
                    onChange={(e) => onImageUrl(e.target.value)}
                    placeholder="https://… or data:image/jpeg;base64,…"
                    rows={2}
                    className={cn(
                      "min-h-[5.5rem] w-full min-w-0 resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-[14px] text-foreground shadow-sm outline-none",
                      "placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/35",
                    )}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </details>
    </div>
  );
}
