/** Default: 3 minutes — feed pool refresh and catch-up batch advance. */
const DEFAULT_FEED_POLL_INTERVAL_MS = 3 * 60 * 1000;

function parsePositiveMs(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1_000) return fallback;
  return Math.floor(n);
}

/**
 * Kraken dashboard poll interval (ms).
 * Set `KRAKEN_FEED_POLL_INTERVAL_MS` in `.env` (exposed via `next.config.ts` `env`).
 */
export const KRAKEN_FEED_POLL_INTERVAL_MS = parsePositiveMs(
  process.env.KRAKEN_FEED_POLL_INTERVAL_MS,
  DEFAULT_FEED_POLL_INTERVAL_MS,
);
