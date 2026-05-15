"use client";

import type { ReactNode } from "react";
import type { ForecastRow, StructuredResultSection } from "@/lib/kraken-signal-result";
import { parseExecutionResult } from "@/lib/kraken-signal-result";
import { cn } from "@/lib/utils";
import { looksLikeMarkdown, MarkdownContent } from "@/components/markdown-content";

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

function TextBlock({ title, body }: { title?: string; body: string }) {
  return (
    <div className="space-y-1">
      {title ? <div className="text-[11px] font-semibold text-muted-foreground">{title}</div> : null}
      {title === "Answer" || title === "Reasoning" || looksLikeMarkdown(body) ? (
        <MarkdownContent variant="signal">{body}</MarkdownContent>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{body}</p>
      )}
    </div>
  );
}

function CitationsList({ links }: { links: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {links.map((href) => (
        <li key={href}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-primary underline-offset-2 hover:underline"
          >
            {href}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ForecastTable({ location, rows }: { location?: string; rows: ForecastRow[] }) {
  const hasRain = rows.some((r) => r.rain_mm != null);
  const hasWind = rows.some((r) => r.wind_kph != null);
  const hasValue = rows.some((r) => r.value != null);

  return (
    <div className="space-y-2">
      {location ? <p className="text-sm text-white/80">{location}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Time</th>
              {hasValue ? <th className="px-3 py-2 font-semibold">Value</th> : null}
              {!hasValue ? <th className="px-3 py-2 font-semibold">Temp (°C)</th> : null}
              {hasWind ? <th className="px-3 py-2 font-semibold">Wind</th> : null}
              {hasRain ? <th className="px-3 py-2 font-semibold">Rain (mm)</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.time}-${i}`} className="border-b border-border/20 last:border-0">
                <td className="px-3 py-2 font-mono text-white/80">{row.time}</td>
                {hasValue ? (
                  <td className="px-3 py-2 tabular-nums text-white/90">
                    {row.value ?? "—"}
                    {row.variable ? (
                      <span className="ml-1 text-muted-foreground">({row.variable})</span>
                    ) : null}
                  </td>
                ) : (
                  <td className="px-3 py-2 tabular-nums text-white/90">{row.temperature_c ?? "—"}</td>
                )}
                {hasWind ? <td className="px-3 py-2 tabular-nums">{row.wind_kph ?? "—"}</td> : null}
                {hasRain ? <td className="px-3 py-2 tabular-nums">{row.rain_mm ?? "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BadgesRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-1.5"
        >
          <span className="text-[11px] font-semibold text-muted-foreground">{item.label}</span>
          <span className="text-sm font-bold text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function KeyValuesBlock({ title, rows }: { title?: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="space-y-2">
      {title ? <div className="text-[11px] font-semibold text-muted-foreground">{title}</div> : null}
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 sm:grid-cols-[120px_1fr] sm:gap-3">
            <dt className="text-xs font-semibold text-muted-foreground">{row.label}</dt>
            <dd className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/85">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function JsonBlock({ body }: { body: string }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border border-border/40 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed text-white/80">
      {body}
    </pre>
  );
}

function renderSection(section: StructuredResultSection, index: number) {
  switch (section.type) {
    case "text":
      return <TextBlock key={index} title={section.title} body={section.body} />;
    case "citations":
      return (
        <div key={index}>
          <SectionTitle>Citations</SectionTitle>
          <CitationsList links={section.links} />
        </div>
      );
    case "forecast":
      return (
        <div key={index}>
          <SectionTitle>Forecast</SectionTitle>
          <ForecastTable location={section.location} rows={section.rows} />
        </div>
      );
    case "badges":
      return (
        <div key={index}>
          <SectionTitle>Detection</SectionTitle>
          <BadgesRow items={section.items} />
        </div>
      );
    case "keyValues":
      return <KeyValuesBlock key={index} title={section.title} rows={section.rows} />;
    case "json":
      return (
        <div key={index}>
          {section.title ? <SectionTitle>{section.title}</SectionTitle> : null}
          <JsonBlock body={section.body} />
        </div>
      );
    default:
      return null;
  }
}

export type KrakenStructuredResultProps = {
  result: unknown;
  className?: string;
};

export function KrakenStructuredResult({ result, className }: KrakenStructuredResultProps) {
  const { sections } = parseExecutionResult(result);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {sections.map((section, i) => renderSection(section, i))}
    </div>
  );
}

export { parseExecutionResult };
