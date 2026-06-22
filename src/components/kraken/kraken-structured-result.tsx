"use client";

import type { ReactNode } from "react";
import type { ForecastRow, SentenceScoreRow, StructuredResultSection } from "@/lib/kraken-signal-result";
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
    <div className="space-y-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5">
      {title ? <div className="text-[11px] font-semibold text-muted-foreground">{title}</div> : null}
      {title === "Answer" || title === "Reasoning" || looksLikeMarkdown(body) ? (
        <MarkdownContent variant="signal">{body}</MarkdownContent>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{body}</p>
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
            className="break-all text-sm text-foreground underline-offset-2 hover:underline"
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
      {location ? <p className="text-sm text-foreground/90">{location}</p> : null}
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
                <td className="px-3 py-2 font-mono text-foreground/90">{row.time}</td>
                {hasValue ? (
                  <td className="px-3 py-2 tabular-nums text-foreground">
                    {row.value ?? "—"}
                    {row.variable ? (
                      <span className="ml-1 text-muted-foreground">({row.variable})</span>
                    ) : null}
                  </td>
                ) : (
                  <td className="px-3 py-2 tabular-nums text-foreground">{row.temperature_c ?? "—"}</td>
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
          <span className="text-sm font-bold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  const renderMarkdown = looksLikeMarkdown(value);

  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2.5">
      <dt className="break-all text-[11px] font-semibold leading-snug text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 min-w-0">
        {renderMarkdown ? (
          <MarkdownContent variant="signal">{value}</MarkdownContent>
        ) : (
          <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/90">
            {value}
          </p>
        )}
      </dd>
    </div>
  );
}

function SentenceScoresTable({ title, rows }: { title?: string; rows: SentenceScoreRow[] }) {
  return (
    <div className="space-y-2">
      {title ? <div className="text-[11px] font-semibold text-muted-foreground">{title}</div> : null}
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-muted-foreground">
              <th className="px-3 py-2 font-semibold w-[72px]">AI Score</th>
              <th className="px-3 py-2 font-semibold">Sentence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pct = (row.score * 100).toFixed(1);
              const isHigh = row.score >= 0.8;
              const isMid = row.score >= 0.4;
              return (
                <tr key={i} className="border-b border-border/20 last:border-0">
                  <td className="px-3 py-2 tabular-nums font-mono">
                    <span className={cn("font-bold", isHigh ? "text-red-400" : isMid ? "text-amber-400" : "text-green-400")}>
                      {pct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 leading-relaxed text-foreground/90">{row.sentence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeyValuesBlock({ title, rows }: { title?: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="space-y-2">
      {title ? <div className="text-[11px] font-semibold text-muted-foreground">{title}</div> : null}
      <dl className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <KeyValueRow key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </div>
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
    case "sentenceScores":
      return <SentenceScoresTable key={index} title={section.title} rows={section.rows} />;
    case "keyValues":
      return <KeyValuesBlock key={index} title={section.title} rows={section.rows} />;
    case "json":
      return null;
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
