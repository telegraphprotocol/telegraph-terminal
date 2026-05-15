import type { DaemonResultItem } from "@/lib/engine-daemon-types";

/** Intent column: prefer routing.intent; else subnet name + optional SN id (matches prior “skill” column). */
export function formatKrakenIntentCell(item: DaemonResultItem): string {
  const intent = item.routing.intent?.trim();
  if (intent) return intent;
  const name = item.routing.subnet_name?.trim() || "unknown";
  const idPart = item.routing.subnet_id ? ` (SN${item.routing.subnet_id})` : "";
  return `${name}${idPart}`;
}
