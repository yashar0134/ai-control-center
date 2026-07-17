import { describe, expect, it } from "vitest";
import {
  summarizeClaudeCodeUsage,
  type ClaudeUsageEventLike,
} from "@/server/domain/claude-usage";

const NOW = new Date(2026, 6, 17, 12, 0, 0);

function event(overrides: Partial<ClaudeUsageEventLike> = {}): ClaudeUsageEventLike {
  return {
    occurredAt: new Date(2026, 6, 16, 10, 0, 0),
    model: "claude-fixture-model-1",
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
    cacheCreationTokens: 5,
    cacheReadTokens: 7,
    provenance: "locally-observed",
    ...overrides,
  };
}

describe("real totals exclude demo data", () => {
  it("ignores demo and any non-locally-observed provenance entirely", () => {
    const summary = summarizeClaudeCodeUsage(
      [
        event(),
        event({ provenance: "demo", totalTokens: 999_999 }),
        event({ provenance: "estimated", totalTokens: 888_888 }),
      ],
      NOW,
    );
    expect(summary.eventCount).toBe(1);
    expect(summary.totalTokens).toBe(30);
    expect(summary.topModels[0].totalTokens).toBe(30);
    expect(summary.dailyTrend.reduce((s, d) => s + d.tokens, 0)).toBe(30);
  });
});

describe("unknown token handling", () => {
  it("keeps totals unknown (null) when every event's value is unknown", () => {
    const summary = summarizeClaudeCodeUsage(
      [
        event({ inputTokens: null, outputTokens: null, totalTokens: null, cacheCreationTokens: null, cacheReadTokens: null }),
      ],
      NOW,
    );
    expect(summary.eventCount).toBe(1);
    expect(summary.inputTokens).toBeNull();
    expect(summary.totalTokens).toBeNull();
    expect(summary.cacheCreationTokens).toBeNull();
  });

  it("sums only known values when some are unknown — never treats null as 0 data", () => {
    const summary = summarizeClaudeCodeUsage(
      [event({ inputTokens: 10 }), event({ inputTokens: null })],
      NOW,
    );
    expect(summary.inputTokens).toBe(10);
    expect(summary.eventCount).toBe(2);
  });
});

describe("model breakdown and trend", () => {
  it("ranks models by known total tokens", () => {
    const summary = summarizeClaudeCodeUsage(
      [
        event({ model: "claude-fixture-small", totalTokens: 10 }),
        event({ model: "claude-fixture-big", totalTokens: 500 }),
        event({ model: "claude-fixture-big", totalTokens: 500 }),
      ],
      NOW,
    );
    expect(summary.topModels[0]).toEqual({
      model: "claude-fixture-big",
      events: 2,
      totalTokens: 1000,
    });
  });

  it("buckets the daily trend by local day over the requested window", () => {
    const summary = summarizeClaudeCodeUsage(
      [
        event({ occurredAt: new Date(2026, 6, 17, 9, 0, 0), totalTokens: 100 }),
        event({ occurredAt: new Date(2026, 6, 16, 9, 0, 0), totalTokens: 50 }),
        event({ occurredAt: new Date(2020, 0, 1), totalTokens: 999 }), // outside window
      ],
      NOW,
      30,
    );
    expect(summary.dailyTrend).toHaveLength(30);
    const last = summary.dailyTrend[summary.dailyTrend.length - 1];
    expect(last).toEqual({ date: "2026-07-17", events: 1, tokens: 100 });
    expect(summary.dailyTrend.reduce((s, d) => s + d.tokens, 0)).toBe(150);
  });
});
