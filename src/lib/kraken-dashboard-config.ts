const DEFAULT_THREE_MIN_MS = 3 * 60 * 1000;

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return fallback;
  return Math.floor(n);
}

/** How often to refetch the collector pool from the daemon API. */
export const KRAKEN_FEED_POLL_INTERVAL_MS = parsePositiveMs(
  process.env.KRAKEN_FEED_POLL_INTERVAL_MS,
  DEFAULT_THREE_MIN_MS,
);

/** How often auto catch-up mode advances to the next page of 50 results (independent of poll). */
export const KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS = parsePositiveMs(
  process.env.KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS,
  DEFAULT_THREE_MIN_MS,
);
