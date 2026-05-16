import type { DaemonQuestionDoc, DaemonResultItem } from "@/lib/engine-daemon-types";

/** Resolved https? URL for opening in a new tab; `null` when absent, `""`, whitespace-only, or invalid. */
export function questionSourceArticleUrl(question: DaemonQuestionDoc): string | null {
  const raw = question.source_url?.trim() ?? "";
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Intent column: prefer routing.intent; else subnet name + optional SN id (matches prior “skill” column). */
export function formatKrakenIntentCell(item: DaemonResultItem): string {
  const intent = item.routing.intent?.trim();
  if (intent) return intent;
  const name = item.routing.subnet_name?.trim() || "unknown";
  const idPart = item.routing.subnet_id ? ` (SN${item.routing.subnet_id})` : "";
  return `${name}${idPart}`;
}
