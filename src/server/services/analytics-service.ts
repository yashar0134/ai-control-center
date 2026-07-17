import { db } from "@/server/db/client";
import {
  systemMetricsSchema,
  type SystemMetrics,
} from "@/server/collectors/system/metrics";
import {
  CLAUDE_CODE_COLLECTOR_ID,
  CLAUDE_CODE_CONNECTION_ID,
} from "@/server/collectors/claude-code/claude-code-collector";
import { realClaudeCodeSource } from "@/server/collectors/claude-code/real-source";
import { summarizeClaudeCodeUsage } from "@/server/domain/claude-usage";
import {
  aggregateCosts,
  costsByDay,
  percentChange,
  toLocalDateKey,
} from "@/server/domain/costs";

/**
 * Read-side queries powering the dashboard, costs, and activity views.
 * All data returned here comes from SQLite; provenance travels with it.
 */

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfPrevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysAgo(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
}

export async function getDashboardData(now = new Date()) {
  const monthStart = startOfMonth(now);
  const prevMonthStart = startOfPrevMonth(now);
  const todayStart = startOfDay(now);
  const trendStart = daysAgo(now, 13);

  const [monthCosts, prevMonthCosts, connections, eventsToday, trendEvents, recentEvents, lastRun, realClaude] =
    await Promise.all([
      db.costRecord.findMany({
        where: { periodStart: { gte: monthStart } },
        include: { connection: { select: { providerId: true } } },
      }),
      db.costRecord.findMany({
        where: { periodStart: { gte: prevMonthStart, lt: monthStart } },
        include: { connection: { select: { providerId: true } } },
      }),
      db.connection.findMany({ include: { provider: true } }),
      // Demo-labeled tiles stay demo-only; real locally-observed usage is
      // reported separately below and never blended into demo numbers.
      db.usageEvent.count({
        where: { occurredAt: { gte: todayStart }, provenance: "demo" },
      }),
      db.usageEvent.findMany({
        where: { occurredAt: { gte: trendStart }, provenance: "demo" },
        select: { occurredAt: true, totalTokens: true },
      }),
      db.usageEvent.findMany({
        orderBy: { occurredAt: "desc" },
        take: 8,
        include: {
          connection: { select: { name: true, provider: { select: { name: true } } } },
        },
      }),
      db.collectorRun.findFirst({ orderBy: { startedAt: "desc" } }),
      // Real (locally-observed) Claude Code usage — always reported separately
      // from demo totals, never blended.
      db.usageEvent.aggregate({
        where: {
          connectionId: CLAUDE_CODE_CONNECTION_ID,
          provenance: "locally-observed",
        },
        _count: { _all: true },
        _sum: { totalTokens: true },
        _max: { occurredAt: true },
      }),
    ]);

  const monthTotals = aggregateCosts(
    monthCosts.map((c) => ({
      amount: c.amount,
      kind: c.kind,
      providerId: c.connection.providerId,
      periodStart: c.periodStart,
    })),
  );
  const prevTotals = aggregateCosts(
    prevMonthCosts.map((c) => ({
      amount: c.amount,
      kind: c.kind,
      providerId: c.connection.providerId,
      periodStart: c.periodStart,
    })),
  );

  // Usage trend: events + tokens per day for the last 14 days.
  const trendMap = new Map<string, { events: number; tokens: number }>();
  for (let i = 13; i >= 0; i--) {
    trendMap.set(toLocalDateKey(daysAgo(now, i)), { events: 0, tokens: 0 });
  }
  for (const e of trendEvents) {
    const key = toLocalDateKey(e.occurredAt);
    const bucket = trendMap.get(key);
    if (bucket) {
      bucket.events += 1;
      bucket.tokens += e.totalTokens ?? 0; // chart aggregates known tokens only
    }
  }

  const providerNames = new Map(
    connections.map((c) => [c.providerId, c.provider.name]),
  );

  const activeConnections = connections.filter(
    (c) => c.status === "demo" || c.status === "manual",
  );

  return {
    monthTotals,
    prevMonthTotal: prevTotals.total,
    costChangePercent: percentChange(monthTotals.total, prevTotals.total),
    activeConnectionCount: activeConnections.length,
    totalConnectionCount: connections.length,
    eventsToday,
    usageTrend: [...trendMap.entries()].map(([date, v]) => ({ date, ...v })),
    costByProvider: Object.entries(monthTotals.byProvider).map(
      ([providerId, amount]) => ({
        providerId,
        providerName: providerNames.get(providerId) ?? providerId,
        amount,
      }),
    ),
    recentEvents,
    lastRun,
    realClaudeUsage: {
      eventCount: realClaude._count._all,
      totalTokens: realClaude._sum.totalTokens,
      lastEventAt: realClaude._max.occurredAt,
    },
  };
}

export interface ActivityFilters {
  connectionId?: string;
  model?: string;
  status?: string;
  provenance?: string;
}

export async function getActivity(filters: ActivityFilters) {
  const where = {
    ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
    ...(filters.model ? { model: filters.model } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.provenance ? { provenance: filters.provenance } : {}),
  };

  const [events, connections, models] = await Promise.all([
    db.usageEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        connection: {
          select: { id: true, name: true, provider: { select: { name: true } } },
        },
      },
    }),
    db.connection.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.usageEvent.findMany({
      distinct: ["model"],
      select: { model: true },
      where: { model: { not: null } },
    }),
  ]);

  return {
    events,
    connections,
    models: models.map((m) => m.model).filter((m): m is string => m !== null),
  };
}

export async function getCostsPageData(now = new Date()) {
  const monthStart = startOfMonth(now);
  const trendStart = daysAgo(now, 29);

  const [monthCosts, trendCosts, records] = await Promise.all([
    db.costRecord.findMany({
      where: { periodStart: { gte: monthStart } },
      include: {
        connection: { select: { providerId: true, provider: { select: { name: true } } } },
      },
    }),
    db.costRecord.findMany({
      where: { periodStart: { gte: trendStart } },
      select: { amount: true, kind: true, periodStart: true },
    }),
    db.costRecord.findMany({
      orderBy: { periodStart: "desc" },
      take: 50,
      include: {
        connection: { select: { name: true, provider: { select: { name: true } } } },
      },
    }),
  ]);

  const totals = aggregateCosts(
    monthCosts.map((c) => ({
      amount: c.amount,
      kind: c.kind,
      providerId: c.connection.providerId,
      periodStart: c.periodStart,
    })),
  );

  const providerNames = new Map(
    monthCosts.map((c) => [c.connection.providerId, c.connection.provider.name]),
  );

  const dailyMap = costsByDay(
    trendCosts.map((c) => ({
      amount: c.amount,
      kind: c.kind,
      providerId: "",
      periodStart: c.periodStart,
    })),
  );
  const dailyTrend: { date: string; amount: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = toLocalDateKey(daysAgo(now, i));
    dailyTrend.push({ date: key, amount: Math.round((dailyMap.get(key) ?? 0) * 100) / 100 });
  }

  return {
    totals,
    byProvider: Object.entries(totals.byProvider).map(([providerId, amount]) => ({
      providerId,
      providerName: providerNames.get(providerId) ?? providerId,
      amount,
    })),
    dailyTrend,
    records,
  };
}

/**
 * Claude Code detail-page data: real (locally-observed) usage only, plus
 * source detection and import-run history. Demo rows are excluded from every
 * total here; where legacy demo events exist they are surfaced separately.
 */
export async function getClaudeCodePageData(now = new Date()) {
  const [events, demoEventCount, lastRun, recentRuns, latestHealth] =
    await Promise.all([
      db.usageEvent.findMany({
        where: {
          connectionId: CLAUDE_CODE_CONNECTION_ID,
          provenance: "locally-observed",
        },
        select: {
          occurredAt: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          cacheCreationTokens: true,
          cacheReadTokens: true,
          provenance: true,
        },
      }),
      db.usageEvent.count({
        where: {
          connectionId: CLAUDE_CODE_CONNECTION_ID,
          provenance: { not: "locally-observed" },
        },
      }),
      db.collectorRun.findFirst({
        where: { collectorId: CLAUDE_CODE_COLLECTOR_ID },
        orderBy: { startedAt: "desc" },
      }),
      db.collectorRun.findMany({
        where: { collectorId: CLAUDE_CODE_COLLECTOR_ID },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      db.healthSnapshot.findFirst({
        where: {
          subjectType: "connection",
          subjectId: CLAUDE_CODE_CONNECTION_ID,
          provenance: "locally-observed",
        },
        orderBy: { capturedAt: "desc" },
      }),
    ]);

  // Safe filesystem detection (existence + counts only — no file contents).
  let detection = { dataDirFound: false, sessionFileCount: 0 };
  try {
    detection = await realClaudeCodeSource.detect();
  } catch {
    // Detection failure is reported as "not detected", never as an error page.
  }

  return {
    summary: summarizeClaudeCodeUsage(events, now),
    demoEventCount,
    lastRun,
    recentRuns,
    latestHealth,
    detection,
  };
}

export async function getSystemPageData() {
  const [realSnapshot, demoSnapshot, lastSystemRun, recentRuns] = await Promise.all([
    db.healthSnapshot.findFirst({
      where: { subjectType: "machine", provenance: "locally-observed" },
      orderBy: { capturedAt: "desc" },
    }),
    db.healthSnapshot.findFirst({
      where: { subjectType: "machine", provenance: "demo" },
      orderBy: { capturedAt: "desc" },
    }),
    db.collectorRun.findFirst({
      where: { collectorId: "windows-system" },
      orderBy: { startedAt: "desc" },
    }),
    db.collectorRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
  ]);

  // Real metrics are validated against the typed schema; anything that does
  // not parse is treated as absent rather than displayed.
  let realMetrics: SystemMetrics | null = null;
  if (realSnapshot?.metricsJson) {
    try {
      const parsed = systemMetricsSchema.safeParse(JSON.parse(realSnapshot.metricsJson));
      realMetrics = parsed.success ? parsed.data : null;
    } catch {
      realMetrics = null;
    }
  }

  let demoMetrics: Record<string, number | string> | null = null;
  if (demoSnapshot?.metricsJson) {
    try {
      demoMetrics = JSON.parse(demoSnapshot.metricsJson);
    } catch {
      demoMetrics = null;
    }
  }

  return { realSnapshot, realMetrics, demoSnapshot, demoMetrics, lastSystemRun, recentRuns };
}
