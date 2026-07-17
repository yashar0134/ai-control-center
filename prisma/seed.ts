/**
 * Deterministic demo seed for AI Control Center.
 *
 * Safe to run repeatedly: providers/connections/capabilities are upserted,
 * settings are only created when missing (your changes are preserved), and
 * demo observations are de-duplicated by their stable dedupe keys.
 *
 * Every generated value carries provenance "demo" and is labeled as demo in
 * the UI. Nothing here reads real accounts, machines, or networks.
 */
import { PrismaClient } from "@prisma/client";
import {
  PROVIDER_REGISTRY,
  INITIAL_CONNECTION_STATUS,
} from "../src/server/providers/registry";
import {
  generateDemoObservationsForConnection,
  generateDemoHealth,
  demoCollector,
  DEMO_PROFILES,
} from "../src/server/collectors/demo/demo-collector";
import {
  splitFreshObservations,
  observationDedupeKey,
} from "../src/server/collectors/dedupe";
import {
  normalizeCostObservation,
  normalizeHealthObservation,
  normalizeUsageObservation,
} from "../src/server/collectors/normalize";
import type { Observation } from "../src/server/collectors/contracts";
import { toLocalDateKey } from "../src/server/domain/costs";
import { DEFAULT_SETTINGS } from "../src/server/services/settings-service";

const db = new PrismaClient();

async function seedProvidersAndConnections() {
  for (const provider of PROVIDER_REGISTRY) {
    await db.provider.upsert({
      where: { id: provider.providerId },
      update: { name: provider.providerName, category: provider.category },
      create: {
        id: provider.providerId,
        name: provider.providerName,
        category: provider.category,
        websiteUrl: provider.websiteUrl,
      },
    });
    for (const conn of provider.connections) {
      const status = INITIAL_CONNECTION_STATUS[conn.connectionId] ?? "planned";
      await db.connection.upsert({
        where: { id: conn.connectionId },
        update: {
          name: conn.name,
          kind: conn.kind,
          // Status reflects registry truth (e.g. claude-code became a real
          // local collector in Phase 3A); statuses are not user-editable.
          status,
          collectionMethod: conn.collectionMethod,
          privacyNotes: conn.privacyNotes,
        },
        create: {
          id: conn.connectionId,
          providerId: provider.providerId,
          name: conn.name,
          kind: conn.kind,
          status,
          collectionMethod: conn.collectionMethod,
          privacyNotes: conn.privacyNotes,
        },
      });
      for (const cap of conn.capabilities) {
        await db.capability.upsert({
          where: {
            connectionId_capability: {
              connectionId: conn.connectionId,
              capability: cap.capability,
            },
          },
          update: { state: cap.state, note: cap.note ?? null },
          create: {
            connectionId: conn.connectionId,
            capability: cap.capability,
            state: cap.state,
            note: cap.note ?? null,
          },
        });
      }
    }
  }
}

async function seedSettings() {
  // Create missing keys only — never overwrite user changes on reseed.
  const existing = new Set((await db.appSetting.findMany()).map((s) => s.key));
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existing.has(key)) {
      await db.appSetting.create({
        data: { key, value: JSON.stringify(value) },
      });
    }
  }
}

async function seedManualSubscriptionCosts(now: Date) {
  // Demo placeholder fees for the two subscriptions, three months back.
  const subs = [
    { connectionId: "chatgpt-subscription", amount: 20 },
    { connectionId: "claude-subscription", amount: 20 },
  ];
  for (let m = 0; m < 3; m++) {
    const periodStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0);
    const monthKey = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
    for (const sub of subs) {
      const dedupeKey = `manual:${sub.connectionId}:${monthKey}`;
      const exists = await db.costRecord.findUnique({ where: { dedupeKey } });
      if (!exists) {
        await db.costRecord.create({
          data: {
            connectionId: sub.connectionId,
            dedupeKey,
            periodStart,
            periodEnd,
            amount: sub.amount,
            currency: "USD",
            kind: "manual",
            provenance: "demo",
            description: "Demo subscription fee — replace with your real fee",
          },
        });
      }
    }
  }
}

async function seedDemoHistory(now: Date) {
  // 30 days of deterministic demo usage/cost history + today's health snapshots.
  const observations: Observation[] = [];
  for (let offset = 29; offset >= 0; offset--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const dateKey = toLocalDateKey(day);
    for (const profile of DEMO_PROFILES) {
      const { usage, cost } = generateDemoObservationsForConnection(profile, dateKey);
      observations.push(...usage, cost);
    }
  }
  observations.push(...generateDemoHealth(toLocalDateKey(now)));

  // De-duplicate against existing rows (reseed safety).
  const usageKeys = observations.filter((o) => o.type === "usage").map((o) => o.dedupeKey);
  const costKeys = observations.filter((o) => o.type === "cost").map((o) => o.dedupeKey);
  const [existingUsage, existingCosts, existingHealth] = await Promise.all([
    db.usageEvent.findMany({ where: { dedupeKey: { in: usageKeys } }, select: { dedupeKey: true } }),
    db.costRecord.findMany({ where: { dedupeKey: { in: costKeys } }, select: { dedupeKey: true } }),
    db.healthSnapshot.findMany({ select: { subjectType: true, subjectId: true, capturedAt: true } }),
  ]);
  const existingKeySet = new Set<string>([
    ...existingUsage.map((u) => `usage:${u.dedupeKey}`),
    ...existingCosts.map((c) => `cost:${c.dedupeKey}`),
    ...existingHealth.map((h) =>
      observationDedupeKey({
        type: "health",
        subjectType: h.subjectType as "connection" | "collector" | "machine",
        subjectId: h.subjectId,
        connectionId: null,
        capturedAt: h.capturedAt,
        status: "unknown",
        provenance: "demo",
      }),
    ),
  ]);

  const { fresh, skipped } = splitFreshObservations(observations, existingKeySet);
  const usage = fresh.filter((o) => o.type === "usage");
  const costs = fresh.filter((o) => o.type === "cost");
  const health = fresh.filter((o) => o.type === "health");

  await db.usageEvent.createMany({ data: usage.map(normalizeUsageObservation) });
  await db.costRecord.createMany({
    data: costs.map((c) => normalizeCostObservation(c, "USD")),
  });
  for (const h of health) {
    await db.healthSnapshot.create({ data: normalizeHealthObservation(h) });
  }

  return { written: usage.length + costs.length + health.length, skipped };
}

async function main() {
  const now = new Date();
  await seedProvidersAndConnections();
  await seedSettings();
  await seedManualSubscriptionCosts(now);
  const { written, skipped } = await seedDemoHistory(now);

  await db.collectorRun.create({
    data: {
      collectorId: demoCollector.id,
      startedAt: now,
      finishedAt: new Date(),
      status: "success",
      observationsWritten: written,
      duplicatesSkipped: skipped,
      message: "Seed run: 30 days of deterministic demo history.",
    },
  });
  await db.auditEvent.create({
    data: {
      actor: "system",
      action: "seed.run",
      subject: "prisma/seed.ts",
      detailsJson: JSON.stringify({ written, skipped }),
    },
  });

  console.log(`Seed complete. Wrote ${written} demo observations (${skipped} already existed).`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
