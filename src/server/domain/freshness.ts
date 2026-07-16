/**
 * Freshness policy for one-shot system snapshots.
 * A snapshot older than this threshold is still shown, but clearly marked
 * "stale" so a past measurement is never mistaken for current state.
 */
export const STALE_AFTER_MS = 2 * 60 * 1000; // 2 minutes

export function isStale(capturedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - capturedAt.getTime() > STALE_AFTER_MS;
}
