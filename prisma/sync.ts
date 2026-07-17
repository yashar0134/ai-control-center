/**
 * Registry → database synchronization (safe on every run).
 *
 * Upserts providers, connections, capabilities, and missing default settings
 * so the database always reflects the compile-time registry truth (e.g. a
 * capability moving from "planned" to "available" when a real collector
 * ships). It NEVER touches usage events, cost records, health snapshots, or
 * any user data — the demo-history seeding lives in seed.ts and runs only on
 * demand.
 */
import type { PrismaClient } from "@prisma/client";
import {
  PROVIDER_REGISTRY,
  INITIAL_CONNECTION_STATUS,
} from "../src/server/providers/registry";
import { DEFAULT_SETTINGS } from "../src/server/services/settings-service";

export async function syncRegistry(db: PrismaClient) {
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

/** Create missing settings keys only — never overwrite user choices. */
export async function ensureDefaultSettings(db: PrismaClient) {
  const existing = new Set((await db.appSetting.findMany()).map((s) => s.key));
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!existing.has(key)) {
      await db.appSetting.create({ data: { key, value: JSON.stringify(value) } });
    }
  }
}
