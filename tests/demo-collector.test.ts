import { describe, expect, it } from "vitest";
import {
  DEMO_PROFILES,
  demoCollector,
  generateDemoObservationsForConnection,
} from "@/server/collectors/demo/demo-collector";
import {
  observationDedupeKey,
  splitFreshObservations,
} from "@/server/collectors/dedupe";
import { normalizeUsageObservation } from "@/server/collectors/normalize";
import type { CollectorContext } from "@/server/collectors/contracts";

const ctx: CollectorContext = {
  now: new Date(2026, 6, 15, 10, 0, 0),
  targetDate: "2026-07-15",
  currency: "USD",
};

describe("demo collector generation", () => {
  it("is deterministic for the same day", () => {
    const a = generateDemoObservationsForConnection(DEMO_PROFILES[0], "2026-07-15");
    const b = generateDemoObservationsForConnection(DEMO_PROFILES[0], "2026-07-15");
    expect(a).toEqual(b);
    const c = generateDemoObservationsForConnection(DEMO_PROFILES[0], "2026-07-16");
    expect(a.usage.map((u) => u.dedupeKey)).not.toEqual(c.usage.map((u) => u.dedupeKey));
  });

  it("marks every observation as demo provenance", async () => {
    const result = await demoCollector.collect(ctx);
    expect(result.observations.length).toBeGreaterThan(0);
    for (const obs of result.observations) {
      expect(obs.provenance).toBe("demo");
    }
  });

  it("includes some events with unknown token counts (never zeroed)", async () => {
    // Across several days, unknown-token events must appear and stay null.
    let sawUnknown = false;
    for (let day = 1; day <= 10 && !sawUnknown; day++) {
      const date = `2026-07-${String(day).padStart(2, "0")}`;
      for (const profile of DEMO_PROFILES) {
        const { usage } = generateDemoObservationsForConnection(profile, date);
        for (const u of usage) {
          if (u.inputTokens === null && u.status === "ok") {
            sawUnknown = true;
            expect(u.totalTokens).toBeNull();
            expect(u.costAmount).toBeNull();
          }
        }
      }
    }
    expect(sawUnknown).toBe(true);
  });
});

describe("demo collector normalization", () => {
  it("maps observations to persistable events with provenance intact", () => {
    const { usage } = generateDemoObservationsForConnection(DEMO_PROFILES[0], "2026-07-15");
    const normalized = normalizeUsageObservation(usage[0]);
    expect(normalized.connectionId).toBe(DEMO_PROFILES[0].connectionId);
    expect(normalized.provenance).toBe("demo");
    expect(normalized.dedupeKey).toContain("demo:");
    // Unknown stays unknown; known totals must equal input + output.
    if (normalized.inputTokens !== null && normalized.outputTokens !== null) {
      expect(normalized.totalTokens).toBe(normalized.inputTokens + normalized.outputTokens);
    } else {
      expect(normalized.totalTokens).toBeNull();
    }
  });

  it("rejects observations with invented provenance", () => {
    const { usage } = generateDemoObservationsForConnection(DEMO_PROFILES[0], "2026-07-15");
    const tampered = { ...usage[0], provenance: "real" as never };
    expect(() => normalizeUsageObservation(tampered)).toThrow();
  });
});

describe("duplicate protection (idempotency)", () => {
  it("re-running the collector for the same day produces zero fresh observations", async () => {
    const first = await demoCollector.collect(ctx);
    const existing = new Set(first.observations.map(observationDedupeKey));
    const second = await demoCollector.collect(ctx);
    const { fresh, skipped } = splitFreshObservations(second.observations, existing);
    expect(fresh).toHaveLength(0);
    expect(skipped).toBe(second.observations.length);
  });

  it("skips duplicates inside a single batch", async () => {
    const result = await demoCollector.collect(ctx);
    const doubled = [...result.observations, ...result.observations];
    const { fresh, skipped } = splitFreshObservations(doubled, new Set());
    expect(fresh).toHaveLength(result.observations.length);
    expect(skipped).toBe(result.observations.length);
  });
});
