/** Human-readable local date/time for receipt and audit timestamps (ISO or parseable strings). */
export function formatExecutionTime(iso?: string): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}
