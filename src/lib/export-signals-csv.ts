import type { DaemonResultItem } from "@/lib/engine-daemon-types";
import { formatKrakenIntentCell } from "@/lib/kraken-signal-format";

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

export function buildSignalsCsv(items: DaemonResultItem[]): string {
  const headers = [
    "id",
    "created_at",
    "intent",
    "question_text",
    "category",
    "interest_score",
    "status",
    "error",
    "cost_usd",
    "source",
    "type",
    "subnet_id",
    "subnet_name",
    "routing_reasoning",
    "error_stage",
    "duration_ms",
    "execution_timestamp",
  ];
  const lines = [rowToCsvLine(headers)];
  for (const item of items) {
    const err = item.execution.error ?? "";
    lines.push(
      rowToCsvLine([
        item.id,
        item.created_at,
        formatKrakenIntentCell(item),
        item.question.text ?? "",
        item.question.category ?? "",
        String(item.question.interest_score ?? ""),
        item.status,
        err,
        String(Number(item.execution.cost_usd ?? 0)),
        item.source,
        item.type,
        item.routing.subnet_id ?? "",
        item.routing.subnet_name ?? "",
        item.routing.reasoning ?? "",
        item.routing.error_stage ?? "",
        String(item.execution.duration_ms ?? ""),
        item.execution.timestamp ?? "",
      ]),
    );
  }
  return lines.join("\r\n");
}

export function downloadSignalsCsv(items: DaemonResultItem[], baseName = "kraken-signals"): void {
  if (items.length === 0) return;
  const csv = buildSignalsCsv(items);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${baseName}-${stamp}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
