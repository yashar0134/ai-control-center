/**
 * Pure aggregation for real Claude Code usage.
 *
 * Only events with provenance "locally-observed" count toward real totals —
 * demo or any other provenance is excluded here, structurally, so demo data
 * can never silently blend into real numbers.
 *
 * Unknown token counts (null) stay unknown: sums only include known values,
 * and a total is null when NO event carried a known value for that field.
 */

export interface ClaudeUsageEventLike {
  occurredAt: Date;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  provenance: string;
}

export interface ClaudeUsageSummary {
  eventCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
  topModels: { model: string; events: number; totalTokens: number | null }[];
  /** Last N days, oldest first: events + known-token sum per local day. */
  dailyTrend: { date: string; events: number; tokens: number }[];
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Sum where null means unknown: returns null only if every value was null. */
function sumKnown(values: (number | null)[]): number | null {
  let sum: number | null = null;
  for (const v of values) {
    if (v === null) continue;
    sum = (sum ?? 0) + v;
  }
  return sum;
}

export function summarizeClaudeCodeUsage(
  events: ClaudeUsageEventLike[],
  now: Date,
  trendDays = 30,
): ClaudeUsageSummary {
  const real = events.filter((e) => e.provenance === "locally-observed");

  const byModel = new Map<string, { events: number; tokens: (number | null)[] }>();
  let firstEventAt: Date | null = null;
  let lastEventAt: Date | null = null;
  for (const e of real) {
    if (!firstEventAt || e.occurredAt < firstEventAt) firstEventAt = e.occurredAt;
    if (!lastEventAt || e.occurredAt > lastEventAt) lastEventAt = e.occurredAt;
    const model = e.model ?? "unknown";
    const entry = byModel.get(model) ?? { events: 0, tokens: [] };
    entry.events += 1;
    entry.tokens.push(e.totalTokens);
    byModel.set(model, entry);
  }

  const topModels = [...byModel.entries()]
    .map(([model, v]) => ({
      model,
      events: v.events,
      totalTokens: sumKnown(v.tokens),
    }))
    .sort((a, b) => (b.totalTokens ?? 0) - (a.totalTokens ?? 0) || b.events - a.events)
    .slice(0, 6);

  const trendMap = new Map<string, { events: number; tokens: number }>();
  for (let i = trendDays - 1; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    trendMap.set(toLocalDateKey(day), { events: 0, tokens: 0 });
  }
  for (const e of real) {
    const bucket = trendMap.get(toLocalDateKey(e.occurredAt));
    if (bucket) {
      bucket.events += 1;
      bucket.tokens += e.totalTokens ?? 0; // trend chart sums known tokens only
    }
  }

  return {
    eventCount: real.length,
    inputTokens: sumKnown(real.map((e) => e.inputTokens)),
    outputTokens: sumKnown(real.map((e) => e.outputTokens)),
    totalTokens: sumKnown(real.map((e) => e.totalTokens)),
    cacheCreationTokens: sumKnown(real.map((e) => e.cacheCreationTokens)),
    cacheReadTokens: sumKnown(real.map((e) => e.cacheReadTokens)),
    firstEventAt,
    lastEventAt,
    topModels,
    dailyTrend: [...trendMap.entries()].map(([date, v]) => ({ date, ...v })),
  };
}
