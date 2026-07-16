import { db } from "@/server/db/client";
import { getCollector } from "@/server/collectors/registry";
import {
  observationDedupeKey,
  splitFreshObservations,
} from "@/server/collectors/dedupe";
import {
  normalizeCostObservation,
  normalizeHealthObservation,
  normalizeUsageObservation,
} from "@/server/collectors/normalize";
import type { CollectorContext, Observation } from "@/server/collectors/contracts";
import { toCollectorError } from "@/server/collectors/errors";
import { RunGate } from "@/server/collectors/run-gate";
import { toLocalDateKey } from "@/server/domain/costs";
import { getSettings } from "./settings-service";

export interface RunCollectorSummary {
  ok: boolean;
  collectorId: string;
  written: number;
  skipped: number;
  message: string;
}

/**
 * In-process gate: one run per collector at a time, plus a short cooldown to
 * stop double-click duplicates. Local single-process app — not a distributed lock.
 */
export const COLLECTOR_COOLDOWN_MS = 5000;
const runGate = new RunGate(COLLECTOR_COOLDOWN_MS);

/**
 * Run a collector end-to-end: collect → validate/normalize → de-duplicate →
 * persist → record the run → record a safe audit event.
 */
export async function runCollector(
  collectorId: string,
  actor: "user" | "system",
): Promise<RunCollectorSummary> {
  const collector = getCollector(collectorId);
  if (!collector) {
    return {
      ok: false,
      collectorId,
      written: 0,
      skipped: 0,
      message: "Unknown collector.",
    };
  }

  const settings = await getSettings();
  if (!settings.collectionEnabled) {
    return {
      ok: false,
      collectorId,
      written: 0,
      skipped: 0,
      message:
        "Local data collection is disabled. Enable it in Settings to collect.",
    };
  }

  const gate = runGate.tryAcquire(collector.id);
  if (!gate.ok) {
    return {
      ok: false,
      collectorId,
      written: 0,
      skipped: 0,
      message:
        gate.reason === "in-flight"
          ? "A collection is already running. Please wait for it to finish."
          : "Collected a moment ago. Please wait a few seconds before collecting again.",
    };
  }

  const startedAt = new Date();
  const ctx: CollectorContext = {
    now: startedAt,
    targetDate: toLocalDateKey(startedAt),
    currency: settings.displayCurrency,
  };

  try {
    const result = await collector.collect(ctx);
    const existingKeys = await findExistingKeys(result.observations);
    const { fresh, skipped } = splitFreshObservations(
      result.observations,
      existingKeys,
    );

    const usage = fresh.filter((o) => o.type === "usage");
    const costs = fresh.filter((o) => o.type === "cost");
    const health = fresh.filter((o) => o.type === "health");
    // Quota observations have no storage yet (no legitimate source exists in
    // this milestone); they are intentionally not persisted.

    await db.$transaction([
      db.usageEvent.createMany({
        data: usage.map(normalizeUsageObservation),
      }),
      db.costRecord.createMany({
        data: costs.map((c) => normalizeCostObservation(c, ctx.currency)),
      }),
      ...health.map((h) =>
        db.healthSnapshot.create({ data: normalizeHealthObservation(h) }),
      ),
      db.collectorRun.create({
        data: {
          collectorId: collector.id,
          startedAt,
          finishedAt: new Date(),
          status: "success",
          observationsWritten: usage.length + costs.length + health.length,
          duplicatesSkipped: skipped,
          message: result.notes?.join(" ") ?? null,
        },
      }),
      db.auditEvent.create({
        data: {
          actor,
          action: "collector.run",
          subject: collector.id,
          detailsJson: JSON.stringify({
            targetDate: ctx.targetDate,
            written: usage.length + costs.length + health.length,
            skipped,
          }),
        },
      }),
    ]);

    const written = usage.length + costs.length + health.length;
    return {
      ok: true,
      collectorId,
      written,
      skipped,
      message:
        written === 0
          ? "Nothing new to write — these observations already exist (duplicate protection)."
          : `Wrote ${written} observation${written === 1 ? "" : "s"}, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    // Classify into a safe category; never persist or show raw errors.
    const safe = toCollectorError(error);
    await db
      .$transaction([
        db.collectorRun.create({
          data: {
            collectorId: collector.id,
            startedAt,
            finishedAt: new Date(),
            status: "failed",
            message: `${safe.category}: ${safe.safeMessage}`,
          },
        }),
        db.auditEvent.create({
          data: {
            actor,
            action: "collector.run",
            subject: collector.id,
            detailsJson: JSON.stringify({ outcome: "failed", category: safe.category }),
          },
        }),
      ])
      .catch(() => undefined);
    return {
      ok: false,
      collectorId,
      written: 0,
      skipped: 0,
      message: safe.safeMessage,
    };
  } finally {
    runGate.release(collector.id);
  }
}

/** Look up which observation dedupe keys already exist in the database. */
async function findExistingKeys(
  observations: Observation[],
): Promise<Set<string>> {
  const usageKeys: string[] = [];
  const costKeys: string[] = [];
  const healthProbes: { subjectType: string; subjectId: string; capturedAt: Date }[] = [];

  for (const obs of observations) {
    if (obs.type === "usage") usageKeys.push(obs.dedupeKey);
    else if (obs.type === "cost") costKeys.push(obs.dedupeKey);
    else if (obs.type === "health")
      healthProbes.push({
        subjectType: obs.subjectType,
        subjectId: obs.subjectId,
        capturedAt: obs.capturedAt,
      });
  }

  const [usage, costs, health] = await Promise.all([
    usageKeys.length
      ? db.usageEvent.findMany({
          where: { dedupeKey: { in: usageKeys } },
          select: { dedupeKey: true },
        })
      : [],
    costKeys.length
      ? db.costRecord.findMany({
          where: { dedupeKey: { in: costKeys } },
          select: { dedupeKey: true },
        })
      : [],
    healthProbes.length
      ? db.healthSnapshot.findMany({
          where: { OR: healthProbes },
          select: { subjectType: true, subjectId: true, capturedAt: true },
        })
      : [],
  ]);

  const keys = new Set<string>();
  for (const u of usage) keys.add(`usage:${u.dedupeKey}`);
  for (const c of costs) keys.add(`cost:${c.dedupeKey}`);
  for (const h of health)
    keys.add(
      observationDedupeKey({
        type: "health",
        subjectType: h.subjectType as "connection" | "collector" | "machine",
        subjectId: h.subjectId,
        connectionId: null,
        capturedAt: h.capturedAt,
        status: "unknown",
        provenance: "demo",
      }),
    );
  return keys;
}
