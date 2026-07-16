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

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return UNKNOWN;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
