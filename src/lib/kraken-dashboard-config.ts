const DEFAULT_THREE_MIN_MS = 3 * 60 * 1000;

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return fallback;
  return Math.floor(n);
}

/** How often to merge the newest daemon page into the collector cache. */
export const KRAKEN_FEED_POLL_INTERVAL_MS = parsePositiveMs(
  process.env.KRAKEN_FEED_POLL_INTERVAL_MS,
  DEFAULT_THREE_MIN_MS,
);

/** How often auto catch-up advances from batch 1 to batch 2 (page 0 only). */
export const KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS = parsePositiveMs(
  process.env.KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS,
  DEFAULT_THREE_MIN_MS,
);

function parseOptionalMinInterest(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10) return undefined;
  return n;
}

/**
 * Optional daemon `min_interest` (0–10). Unset = no server-side interest filter.
 * Set `NEXT_PUBLIC_KRAKEN_MIN_INTEREST=1` to restore the previous default.
 */
export const KRAKEN_MIN_INTEREST = parseOptionalMinInterest(
  process.env.NEXT_PUBLIC_KRAKEN_MIN_INTEREST,
);
