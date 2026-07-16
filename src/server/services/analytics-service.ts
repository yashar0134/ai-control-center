import { db } from "@/server/db/client";
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

  const [monthCosts, prevMonthCosts, connections, eventsToday, trendEvents, recentEvents, lastRun] =
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
      db.usageEvent.count({ where: { occurredAt: { gte: todayStart } } }),
      db.usageEvent.findMany({
        where: { occurredAt: { gte: trendStart } },
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

export async function getSystemPageData() {
  const [machineSnapshot, lastRun, recentRuns] = await Promise.all([
    db.healthSnapshot.findFirst({
      where: { subjectType: "machine" },
      orderBy: { capturedAt: "desc" },
    }),
    db.collectorRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.collectorRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
  ]);

  let metrics: Record<string, number | string> | null = null;
  if (machineSnapshot?.metricsJson) {
    try {
      metrics = JSON.parse(machineSnapshot.metricsJson);
    } catch {
      metrics = null;
    }
  }

  return { machineSnapshot, metrics, lastRun, recentRuns };
}
