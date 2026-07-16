import { describe, expect, it } from "vitest";
import {
  capabilityDeclarationSchema,
  capabilityStateSchema,
  deriveTotalTokens,
  provenanceSchema,
} from "@/server/domain/types";
import { aggregateCosts, percentChange } from "@/server/domain/costs";
import { parseSettingsRows, appSettingsSchema, DEFAULT_SETTINGS } from "@/server/services/settings-service";
import { formatTokens, UNKNOWN } from "@/lib/format";

describe("capability modeling", () => {
  it("accepts every declared capability state", () => {
    for (const state of ["available", "unavailable", "unsupported", "manual", "estimated", "planned"]) {
      expect(capabilityStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it("rejects invented states and unknown capability keys", () => {
    expect(capabilityStateSchema.safeParse("connected").success).toBe(false);
    expect(
      capabilityDeclarationSchema.safeParse({ capability: "telepathy", state: "available" }).success,
    ).toBe(false);
    expect(
      capabilityDeclarationSchema.safeParse({ capability: "quota", state: "unsupported" }).success,
    ).toBe(true);
  });
});

describe("provenance modeling", () => {
  it("accepts all truthful origins and rejects fabricated ones", () => {
    for (const p of ["live", "locally-observed", "manual", "estimated", "demo", "stale", "unavailable", "unsupported"]) {
      expect(provenanceSchema.safeParse(p).success).toBe(true);
    }
    expect(provenanceSchema.safeParse("real").success).toBe(false);
    expect(provenanceSchema.safeParse("").success).toBe(false);
  });
});

describe("unknown token values", () => {
  it("never treats unknown as zero when deriving totals", () => {
    expect(deriveTotalTokens(null, 500)).toBeNull();
    expect(deriveTotalTokens(500, null)).toBeNull();
    expect(deriveTotalTokens(null, null)).toBeNull();
    expect(deriveTotalTokens(200, 300)).toBe(500);
    expect(deriveTotalTokens(null, null, 900)).toBe(900);
  });

  it("renders unknown counts as 'unknown', and zero as '0'", () => {
    expect(formatTokens(null)).toBe(UNKNOWN);
    expect(formatTokens(undefined)).toBe(UNKNOWN);
    expect(formatTokens(0)).toBe("0");
  });
});

describe("cost aggregation", () => {
  const records = [
    { amount: 10, kind: "estimated", providerId: "openai", periodStart: new Date(2026, 6, 1) },
    { amount: 5.5, kind: "estimated", providerId: "anthropic", periodStart: new Date(2026, 6, 2) },
    { amount: 20, kind: "manual", providerId: "openai", periodStart: new Date(2026, 6, 1) },
  ];

  it("totals overall, by kind, and by provider", () => {
    const t = aggregateCosts(records);
    expect(t.total).toBeCloseTo(35.5);
    expect(t.byKind.estimated).toBeCloseTo(15.5);
    expect(t.byKind.manual).toBe(20);
    expect(t.byProvider.openai).toBeCloseTo(30);
    expect(t.byProvider.anthropic).toBeCloseTo(5.5);
  });

  it("reports change vs an empty previous period as unknown, not 0%", () => {
    expect(percentChange(35.5, 0)).toBeNull();
    expect(percentChange(150, 100)).toBeCloseTo(50);
  });
});

describe("settings validation", () => {
  it("falls back to defaults for malformed stored rows", () => {
    const settings = parseSettingsRows([
      { key: "displayCurrency", value: '"EUR"' },
      { key: "retentionDays", value: "not-json{" },
      { key: "collectionEnabled", value: "false" },
    ]);
    expect(settings.displayCurrency).toBe("EUR");
    expect(settings.retentionDays).toBe(DEFAULT_SETTINGS.retentionDays);
    expect(settings.collectionEnabled).toBe(false);
  });

  it("rejects out-of-range and unknown values", () => {
    expect(
      appSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, retentionDays: 3 }).success,
    ).toBe(false);
    expect(
      appSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, displayCurrency: "BTC" }).success,
    ).toBe(false);
    expect(appSettingsSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
  });
});
