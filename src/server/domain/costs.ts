import type { CostKind } from "./types";

/**
 * Pure cost-aggregation logic. Kept free of database access so it is
 * trivially testable and reusable by dashboard, costs page, and future
 * hosted modes.
 */

export interface CostRecordLike {
  amount: number;
  kind: CostKind | string;
  providerId: string;
  periodStart: Date;
}

export interface CostTotals {
  total: number;
  byKind: Record<string, number>;
  byProvider: Record<string, number>;
}

export function aggregateCosts(records: CostRecordLike[]): CostTotals {
  const totals: CostTotals = { total: 0, byKind: {}, byProvider: {} };
  for (const r of records) {
    totals.total += r.amount;
    totals.byKind[r.kind] = (totals.byKind[r.kind] ?? 0) + r.amount;
    totals.byProvider[r.providerId] =
      (totals.byProvider[r.providerId] ?? 0) + r.amount;
  }
  return totals;
}

/** Sum amounts per local calendar day (YYYY-MM-DD) for trend charts. */
export function costsByDay(records: CostRecordLike[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const r of records) {
    const day = toLocalDateKey(r.periodStart);
    byDay.set(day, (byDay.get(day) ?? 0) + r.amount);
  }
  return byDay;
}

/**
 * Percentage change between periods. Returns null (unknown) when the previous
 * period is zero or missing — a change against nothing is not 0%.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
