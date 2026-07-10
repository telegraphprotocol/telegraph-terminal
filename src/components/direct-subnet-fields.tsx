"use client";

import { ChevronDown, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, readImageFileAsDataUrl } from "@/lib/utils";
import { endpointNeedsImage, type ParsedSubnetYaml, type SubnetEndpointSpec } from "@/lib/subnet-direct-spec";

const LITELLM_MODELS = ["nova-2-lite", "nova-pro", "nova-premier", "deepseek", "voxtral", "qwen", "kimi"];

const fieldClass = cn(
  "min-h-11 w-full min-w-0 rounded-lg border border-border/80 bg-input px-3 py-2.5 text-[14px] text-foreground shadow-sm outline-none transition-colors",
  "hover:border-border focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30",
  "placeholder:text-muted-foreground/60",
);

/**
 * Native <select> option-list hover/selection colors are OS-rendered and can't be
 * reliably restyled cross-browser. Use a custom listbox instead so hover/selected
 * states actually match the app theme.
 */
function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const MAX_PANEL_HEIGHT = 240; // matches max-h-60 below

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < MAX_PANEL_HEIGHT && rect.top > spaceBelow);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value ?? placeholder;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          fieldClass,
          "flex items-center justify-between gap-2 text-left",
          open && "border-orange-600 dark:border-orange-500",
        )}
      >
        <span className={cn("truncate", !value && "text-muted-foreground/60")}>{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 transition-transform",
            open ? "rotate-180 text-orange-700/70 dark:text-orange-400/70" : "text-muted-foreground",
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: openUpward ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: openUpward ? 6 : -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            className={cn(
              "absolute left-0 right-0 z-50 max-h-60 overflow-auto rounded-lg border border-orange-500/40 bg-popover/95 p-1 shadow-2xl shadow-orange-500/10 backdrop-blur-xl",
              openUpward ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
            )}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-all duration-200",
                  o.value === value
                    ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                    : "text-muted-foreground hover:bg-orange-500/8 hover:text-orange-700 dark:hover:text-orange-300",
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value ? <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" /> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

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
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageFileError, setImageFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const isLiteLLM = spec?.slug === "litellm" || spec?.id === "104";
  const needsImage = endpointNeedsImage(spec, endpointPath);
  const needsLat = req.includes("lat");
  const needsLon = req.includes("lon");

  useEffect(() => {
    if (isLiteLLM && !LITELLM_MODELS.includes(model)) {
      onModel(LITELLM_MODELS[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiteLLM]);

  const loadImageFile = (file: File | undefined | null) => {
    if (!file) return;
    setImageFileError(null);
    readImageFileAsDataUrl(file)
      .then(onImageUrl)
      .catch((err: Error) => setImageFileError(err.message));
  };

  return (
    <div className="mx-auto w-full max-w-[720px] min-w-0 px-4 pb-2 sm:px-6">
      <details
        open={panelOpen}
        onToggle={(e) => setPanelOpen((e.target as HTMLDetailsElement).open)}
        className="group rounded-xl border border-border bg-popover px-3 py-2 shadow-md sm:px-4 sm:py-3"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 py-1 text-left [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-[12px] font-semibold uppercase tracking-wide text-foreground">
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
                  <p className="min-h-11 rounded-lg border border-border/80 bg-input px-3 py-2.5 text-[14px] leading-snug text-foreground shadow-sm">
                    {endpoints[0].method} {endpoints[0].path}
                  </p>
                ) : (
                  <CustomSelect
                    value={endpointPath ?? ""}
                    onChange={onEndpointPath}
                    options={endpoints.map((e) => ({ value: e.path, label: `${e.method} ${e.path}` }))}
                  />
                )}
              </div>

              {needsModel ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Model
                  </label>
                  {isLiteLLM ? (
                    <CustomSelect
                      value={model}
                      onChange={onModel}
                      options={LITELLM_MODELS.map((m) => ({ value: m, label: m }))}
                      placeholder="Select a model…"
                    />
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => onModel(e.target.value)}
                      placeholder={modelPlaceholder}
                      autoComplete="off"
                      className={fieldClass}
                    />
                  )}
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
                        className={fieldClass}
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
                        className={fieldClass}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {needsImage ? (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Image
                  </label>

                  {imageUrl.trim().startsWith("data:image") ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-input px-3 py-2.5 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt="Selected upload preview"
                        className="h-14 w-14 shrink-0 rounded-md border border-border/60 object-cover"
                      />
                      <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">Image attached</p>
                      <button
                        type="button"
                        onClick={() => onImageUrl("")}
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                        aria-label="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(true);
                      }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(false);
                        loadImageFile(e.dataTransfer.files?.[0]);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "flex min-h-[5.5rem] w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors",
                        isDraggingImage
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-input hover:border-primary/50 hover:bg-input/80",
                      )}
                    >
                      <Upload size={18} className="text-muted-foreground" aria-hidden />
                      <p className="text-[12px] text-muted-foreground">
                        Drag & drop an image, or <span className="font-medium text-foreground">click to browse</span>
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => loadImageFile(e.target.files?.[0])}
                        className="hidden"
                      />
                    </div>
                  )}

                  {imageFileError ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400">{imageFileError}</p>
                  ) : null}

                  <details className="text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer select-none hover:text-foreground">Or paste a URL / base64 string</summary>
                    <textarea
                      value={imageUrl}
                      onChange={(e) => onImageUrl(e.target.value)}
                      placeholder="https://… or data:image/jpeg;base64,…"
                      rows={2}
                      className={cn(fieldClass, "mt-1.5 min-h-[4.5rem] resize-y")}
                    />
                  </details>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </details>
    </div>
  );
}
