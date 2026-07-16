import type {
  Collector,
  CollectorContext,
  CollectorResult,
  CostObservation,
  HealthObservation,
  Observation,
  UsageObservation,
} from "../contracts";

/**
 * Demo collector — the vertical-slice proof of the collector architecture.
 *
 * It fabricates NOTHING that pretends to be real: every observation carries
 * provenance "demo". Generation is deterministic per calendar day, so running
 * the collector twice on the same day produces identical dedupe keys and the
 * second run writes nothing (duplicate protection is exercised end-to-end).
 *
 * It never calls a network API and never reads machine or personal data.
 */

// --- deterministic PRNG (xmur3 hash + mulberry32) ---
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoConnectionProfile {
  connectionId: string;
  eventType: string;
  models: string[];
  /** pseudo price per 1K total tokens, used ONLY for clearly-labeled demo estimates */
  demoRatePer1k: number;
  minEvents: number;
  maxEvents: number;
}

export const DEMO_PROFILES: DemoConnectionProfile[] = [
  {
    connectionId: "openai-api",
    eventType: "chat",
    models: ["gpt-5.2", "gpt-5-mini", "o4-mini"],
    demoRatePer1k: 0.012,
    minEvents: 5,
    maxEvents: 12,
  },
  {
    connectionId: "anthropic-api",
    eventType: "chat",
    models: ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
    demoRatePer1k: 0.014,
    minEvents: 4,
    maxEvents: 10,
  },
  {
    connectionId: "claude-code",
    eventType: "coding-session",
    models: ["claude-opus-4-8", "claude-sonnet-5"],
    demoRatePer1k: 0.014,
    minEvents: 2,
    maxEvents: 6,
  },
];

function dateAt(targetDate: string, hour: number, minute: number): Date {
  const [y, m, d] = targetDate.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/** Generate one connection's demo observations for one calendar day. Pure and deterministic. */
export function generateDemoObservationsForConnection(
  profile: DemoConnectionProfile,
  targetDate: string,
): { usage: UsageObservation[]; cost: CostObservation } {
  const rand = mulberry32(hashSeed(`${profile.connectionId}:${targetDate}`));
  const count =
    profile.minEvents +
    Math.floor(rand() * (profile.maxEvents - profile.minEvents + 1));

  const usage: UsageObservation[] = [];
  let estimatedDayCost = 0;

  for (let i = 0; i < count; i++) {
    const hour = 8 + Math.floor(rand() * 13); // 08:00–20:59
    const minute = Math.floor(rand() * 60);
    const model = profile.models[Math.floor(rand() * profile.models.length)];
    const failed = rand() < 0.06;
    // ~15% of demo events have unknown token counts, proving unknown-handling.
    const tokensUnknown = rand() < 0.15;

    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let totalTokens: number | null = null;
    let costAmount: number | null = null;

    if (!tokensUnknown && !failed) {
      inputTokens = 200 + Math.floor(rand() * 6000);
      outputTokens = 100 + Math.floor(rand() * 3500);
      totalTokens = inputTokens + outputTokens;
      costAmount =
        Math.round((totalTokens / 1000) * profile.demoRatePer1k * 10000) / 10000;
      estimatedDayCost += costAmount;
    }

    usage.push({
      type: "usage",
      connectionId: profile.connectionId,
      dedupeKey: `demo:${profile.connectionId}:${targetDate}:${i}`,
      occurredAt: dateAt(targetDate, hour, minute),
      eventType: profile.eventType,
      model,
      status: failed ? "error" : "ok",
      inputTokens,
      outputTokens,
      totalTokens,
      costAmount,
      costKind: costAmount === null ? null : "estimated",
      provenance: "demo",
    });
  }

  const cost: CostObservation = {
    type: "cost",
    connectionId: profile.connectionId,
    dedupeKey: `demo:${profile.connectionId}:${targetDate}:day-cost`,
    periodStart: dateAt(targetDate, 0, 0),
    periodEnd: dateAt(targetDate, 23, 59),
    amount: Math.round(estimatedDayCost * 100) / 100,
    kind: "estimated",
    provenance: "demo",
    description: `Demo estimated daily spend (${targetDate})`,
  };

  return { usage, cost };
}

/** Deterministic demo machine + connection health for one day. */
export function generateDemoHealth(targetDate: string): HealthObservation[] {
  const rand = mulberry32(hashSeed(`health:${targetDate}`));
  const capturedAt = dateAt(targetDate, 12, 0);

  const machine: HealthObservation = {
    type: "health",
    subjectType: "machine",
    subjectId: "local-machine",
    connectionId: null,
    capturedAt,
    status: "ok",
    provenance: "demo",
    metrics: {
      cpuPercent: Math.round(10 + rand() * 55),
      memoryUsedGb: Math.round((6 + rand() * 14) * 10) / 10,
      memoryTotalGb: 32,
      diskUsedGb: Math.round(320 + rand() * 60),
      diskTotalGb: 1000,
      networkDownMbps: Math.round(rand() * 90 * 10) / 10,
      networkUpMbps: Math.round(rand() * 25 * 10) / 10,
    },
  };

  const connections: HealthObservation[] = DEMO_PROFILES.map((p) => ({
    type: "health",
    subjectType: "connection",
    subjectId: p.connectionId,
    connectionId: p.connectionId,
    capturedAt,
    status: rand() < 0.9 ? "ok" : "degraded",
    provenance: "demo",
  }));

  return [machine, ...connections];
}

export const demoCollector: Collector = {
  id: "demo-generator",
  name: "Demo data generator",
  description:
    "Generates clearly-labeled, deterministic demo usage, cost, and health data to prove the collector pipeline. No network calls, no machine data.",
  method: "internal-demo",
  connectionIds: DEMO_PROFILES.map((p) => p.connectionId),
  privacyNotes:
    "Reads nothing. Generates synthetic data only, always marked with provenance 'demo'.",
  async collect(ctx: CollectorContext): Promise<CollectorResult> {
    const observations: Observation[] = [];
    for (const profile of DEMO_PROFILES) {
      const { usage, cost } = generateDemoObservationsForConnection(
        profile,
        ctx.targetDate,
      );
      observations.push(...usage, cost);
    }
    observations.push(...generateDemoHealth(ctx.targetDate));
    return {
      observations,
      notes: [
        `Deterministic demo data for ${ctx.targetDate}; re-running today is a no-op.`,
      ],
    };
  },
};
