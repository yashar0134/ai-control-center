import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Collector service behavior with mocked persistence, settings, and registry
 * boundaries — no database, no real collectors, runs on any platform.
 */

const { dbMock, settingsState } = vi.hoisted(() => ({
  dbMock: {
    usageEvent: {
      createMany: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    costRecord: {
      createMany: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
    },
    healthSnapshot: {
      create: vi.fn(async (input: { data: Record<string, unknown> }) => ({ ...input })),
      findMany: vi.fn(async () => []),
    },
    collectorRun: {
      create: vi.fn(async (input: { data: Record<string, unknown> }) => ({ ...input })),
    },
    auditEvent: {
      create: vi.fn(async (input: { data: Record<string, unknown> }) => ({ ...input })),
    },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
  },
  settingsState: { collectionEnabled: true },
}));

vi.mock("@/server/db/client", () => ({ db: dbMock }));
vi.mock("@/server/services/settings-service", () => ({
  getSettings: vi.fn(async () => ({
    displayCurrency: "USD",
    weekStart: "monday",
    collectionEnabled: settingsState.collectionEnabled,
    retentionDays: 90,
    anonymizedMetadata: true,
    theme: "dark",
  })),
}));

let releaseSlow: (() => void) | undefined;

vi.mock("@/server/collectors/registry", () => {
  const healthObservation = {
    type: "health",
    subjectType: "machine",
    subjectId: "local-machine",
    connectionId: null,
    capturedAt: new Date(2026, 6, 16, 12, 0, 0),
    status: "ok",
    provenance: "locally-observed",
    metrics: { osFamily: "windows", cpuPercent: 42 },
  };
  const collectors = [
    {
      id: "fake-ok",
      name: "Fake OK",
      description: "",
      method: "local-process",
      connectionIds: [],
      privacyNotes: "",
      collect: async () => ({ observations: [healthObservation], notes: [] }),
    },
    {
      id: "fake-fail",
      name: "Fake failing",
      description: "",
      method: "local-process",
      connectionIds: [],
      privacyNotes: "",
      collect: async () => {
        const { CollectorError } = await import("@/server/collectors/errors");
        throw new CollectorError("timeout", "Collection took too long and was stopped.");
      },
    },
    {
      id: "fake-slow",
      name: "Fake slow",
      description: "",
      method: "local-process",
      connectionIds: [],
      privacyNotes: "",
      collect: () =>
        new Promise((resolve) => {
          releaseSlow = () => resolve({ observations: [], notes: [] });
        }),
    },
  ];
  return {
    listCollectors: () => collectors,
    getCollector: (id: string) => collectors.find((c) => c.id === id),
  };
});

import { runCollector } from "@/server/services/collector-service";

beforeEach(() => {
  vi.clearAllMocks();
  settingsState.collectionEnabled = true;
});

describe("collection-disabled behavior", () => {
  it("refuses to run and writes nothing when local collection is off", async () => {
    settingsState.collectionEnabled = false;
    const result = await runCollector("fake-ok", "user");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Settings");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
    expect(dbMock.healthSnapshot.create).not.toHaveBeenCalled();
    expect(dbMock.collectorRun.create).not.toHaveBeenCalled();
  });
});

describe("successful run persistence", () => {
  it("writes the snapshot, records a CollectorRun, and records a safe AuditEvent", async () => {
    const result = await runCollector("fake-ok", "user");
    expect(result.ok).toBe(true);
    expect(dbMock.healthSnapshot.create).toHaveBeenCalledTimes(1);
    const snapshot = dbMock.healthSnapshot.create.mock.calls[0][0];
    expect(snapshot.data.provenance).toBe("locally-observed");
    expect(String(snapshot.data.metricsJson)).toContain("cpuPercent");
    expect(dbMock.collectorRun.create).toHaveBeenCalledTimes(1);
    const audit = dbMock.auditEvent.create.mock.calls[0][0];
    expect(audit.data.action).toBe("collector.run");
    // Audit metadata stays safe: counts only, no metric values or identifiers.
    expect(String(audit.data.detailsJson ?? "")).not.toContain("cpuPercent");
  });
});

describe("failure handling", () => {
  it("stores a failed run with a safe category and returns a friendly message", async () => {
    const result = await runCollector("fake-fail", "user");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Collection took too long and was stopped.");
    const run = dbMock.collectorRun.create.mock.calls[0][0];
    expect(run.data.status).toBe("failed");
    expect(String(run.data.message)).toContain("timeout");
    expect(String(run.data.message)).not.toContain("stack");
  });

  it("rejects unknown collector ids", async () => {
    const result = await runCollector("does-not-exist", "user");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Unknown collector.");
  });
});

describe("concurrent-run prevention", () => {
  it("blocks a second run while one is in flight", async () => {
    const first = runCollector("fake-slow", "user");
    // Give the first run a tick to pass the settings check and acquire the gate.
    await new Promise((r) => setTimeout(r, 10));
    const second = await runCollector("fake-slow", "user");
    expect(second.ok).toBe(false);
    expect(second.message).toContain("already running");
    releaseSlow?.();
    const firstResult = await first;
    expect(firstResult.ok).toBe(true);
  });

  it("applies a cooldown immediately after a run finishes", async () => {
    await runCollector("fake-ok", "user");
    const again = await runCollector("fake-ok", "user");
    expect(again.ok).toBe(false);
    expect(again.message).toContain("wait a few seconds");
  });
});
