/**
 * Formatting helpers using native Intl APIs.
 * Unknown values (null/undefined) always render as an explicit "unknown"
 * marker — never as 0.
 */

export const UNKNOWN = "unknown";

export function formatCurrency(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount === null || amount === undefined) return UNKNOWN;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTokens(count: number | null | undefined): string {
  if (count === null || count === undefined) return UNKNOWN;
  return new Intl.NumberFormat("en-US").format(count);
}

export function formatCompact(count: number | null | undefined): string {
  if (count === null || count === undefined) return UNKNOWN;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatShortDay(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Memory/disk sizes: binary units, labeled honestly as GiB (1 GiB = 1024³ bytes).
 */
export function formatGiB(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return UNKNOWN;
  const gib = bytes / 1024 ** 3;
  return `${gib >= 100 ? gib.toFixed(0) : gib.toFixed(1)} GiB`;
}

/**
 * Network throughput: stored as bytes/second, displayed as Mbps
 * (1 Mbps = 10⁶ bits per second).
 */
export function formatMbps(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec === null || bytesPerSec === undefined || !Number.isFinite(bytesPerSec)) {
    return UNKNOWN;
  }
  const mbps = (bytesPerSec * 8) / 1_000_000;
  const digits = mbps >= 100 ? 0 : mbps >= 10 ? 1 : 2;
  return `${mbps.toFixed(digits)} Mbps`;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return UNKNOWN;
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
