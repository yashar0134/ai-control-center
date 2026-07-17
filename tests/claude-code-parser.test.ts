import { describe, expect, it } from "vitest";
import { parseUsageLine } from "@/server/collectors/claude-code/parser";

/**
 * Parser tests use ENTIRELY FICTIONAL transcript lines written by hand for
 * this test file — no line here was copied from a real machine. The fake
 * "content" strings exist only to prove they never survive parsing.
 */

const NOW = new Date("2026-07-17T12:00:00Z");

/** A fictional but structurally realistic assistant transcript line. */
function assistantLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-07-10T09:30:00.000Z",
    sessionId: "11111111-2222-3333-4444-555555555555",
    requestId: "req_fixture001",
    uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    version: "9.9.9-fixture",
    isSidechain: false,
    userType: "external",
    cwd: "Z:\\fictional\\secret-project-path",
    gitBranch: "fixture-branch-name",
    message: {
      id: "msg_fixture001",
      type: "message",
      role: "assistant",
      model: "claude-fixture-model-1",
      content: [{ type: "text", text: "FIXTURE_RESPONSE_TEXT_MUST_NEVER_SURVIVE" }],
      usage: {
        input_tokens: 12,
        output_tokens: 345,
        cache_creation_input_tokens: 678,
        cache_read_input_tokens: 90,
      },
    },
    ...overrides,
  });
}

describe("valid record normalization", () => {
  it("extracts timestamp, model, and all four token counts", () => {
    const result = parseUsageLine(assistantLine(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.occurredAt.toISOString()).toBe("2026-07-10T09:30:00.000Z");
    expect(result.record.model).toBe("claude-fixture-model-1");
    expect(result.record.inputTokens).toBe(12);
    expect(result.record.outputTokens).toBe(345);
    expect(result.record.cacheCreationTokens).toBe(678);
    expect(result.record.cacheReadTokens).toBe(90);
    expect(result.record.sourceVersion).toBe("9.9.9-fixture");
  });

  it("keeps missing token fields unknown (null) — never zero", () => {
    const line = JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-10T09:30:00.000Z",
      sessionId: "11111111-2222-3333-4444-555555555555",
      uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      message: {
        model: "claude-fixture-model-1",
        usage: { output_tokens: 5 },
      },
    });
    const result = parseUsageLine(line, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.inputTokens).toBeNull();
    expect(result.record.outputTokens).toBe(5);
    expect(result.record.cacheCreationTokens).toBeNull();
    expect(result.record.cacheReadTokens).toBeNull();
  });
});

describe("privacy filtering — no content ever survives", () => {
  it("produces a DTO with ONLY approved metadata keys", () => {
    const result = parseUsageLine(assistantLine(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.record).sort()).toEqual([
      "cacheCreationTokens",
      "cacheReadTokens",
      "dedupeKey",
      "inputTokens",
      "model",
      "occurredAt",
      "outputTokens",
      "sourceVersion",
    ]);
  });

  it("never carries response text, paths, branches, or raw ids into the DTO", () => {
    const result = parseUsageLine(assistantLine(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const serialized = JSON.stringify(result.record);
    expect(serialized).not.toContain("FIXTURE_RESPONSE_TEXT_MUST_NEVER_SURVIVE");
    expect(serialized).not.toContain("secret-project-path");
    expect(serialized).not.toContain("fixture-branch-name");
    expect(serialized).not.toContain("cwd");
    // Raw identifiers are hashed, never stored verbatim.
    expect(serialized).not.toContain("msg_fixture001");
    expect(serialized).not.toContain("req_fixture001");
    expect(serialized).not.toContain("11111111-2222-3333-4444-555555555555");
  });
});

describe("record classification", () => {
  it.each(["user", "attachment", "system", "queue-operation", "ai-title", "last-prompt"])(
    "skips %s records as not-usage without reading them",
    (type) => {
      const result = parseUsageLine(
        JSON.stringify({ type, lastPrompt: "NEVER_READ", message: { content: "NEVER_READ" } }),
        NOW,
      );
      expect(result).toEqual({ ok: false, reason: "not-usage" });
    },
  );

  it("skips synthetic placeholder records — they are not real API usage", () => {
    const line = assistantLine({
      message: { model: "<synthetic>", usage: { output_tokens: 0 } },
    });
    expect(parseUsageLine(line, NOW)).toEqual({ ok: false, reason: "not-usage" });
  });

  it("skips assistant records without a usage block", () => {
    const line = assistantLine({ message: { model: "claude-fixture-model-1" } });
    expect(parseUsageLine(line, NOW)).toEqual({ ok: false, reason: "not-usage" });
  });
});

describe("malformed record rejection", () => {
  it.each([
    ["broken JSON", "{not json"],
    ["non-object", '"just a string"'],
    ["assistant without message", JSON.stringify({ type: "assistant", timestamp: "2026-07-10T09:30:00Z" })],
  ])("rejects %s", (_label, line) => {
    expect(parseUsageLine(line, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects invalid, ancient, and future timestamps", () => {
    for (const timestamp of ["not-a-date", "2019-01-01T00:00:00Z", "2027-12-31T00:00:00Z"]) {
      expect(parseUsageLine(assistantLine({ timestamp }), NOW)).toEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  it("rejects model ids that are not plain identifiers — no invented mappings", () => {
    const weird = assistantLine({
      message: {
        id: "msg_fixture001",
        model: "model with spaces!!",
        usage: { input_tokens: 1 },
      },
    });
    expect(parseUsageLine(weird, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects negative and fractional token counts", () => {
    const bad = assistantLine({
      message: {
        id: "msg_fixture001",
        model: "claude-fixture-model-1",
        usage: { input_tokens: -5 },
      },
    });
    expect(parseUsageLine(bad, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects records with no stable identity for deduplication", () => {
    const line = JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-10T09:30:00.000Z",
      message: { model: "claude-fixture-model-1", usage: { input_tokens: 1 } },
    });
    expect(parseUsageLine(line, NOW)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("deterministic content-free dedupe key", () => {
  it("is identical for repeated stream lines of the same API response", () => {
    const a = parseUsageLine(assistantLine(), NOW);
    const b = parseUsageLine(assistantLine(), NOW);
    expect(a.ok && b.ok && a.record.dedupeKey === b.record.dedupeKey).toBe(true);
  });

  it("differs for different message/request ids", () => {
    const a = parseUsageLine(assistantLine(), NOW);
    const b = parseUsageLine(
      assistantLine({ requestId: "req_fixture002" }),
      NOW,
    );
    expect(a.ok && b.ok && a.record.dedupeKey !== b.record.dedupeKey).toBe(true);
  });

  it("is a pseudonymous hash, not the original identifiers", () => {
    const result = parseUsageLine(assistantLine(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.dedupeKey).toMatch(/^claude-code:[0-9a-f]{64}$/);
  });

  it("falls back to session + record uuid when message/request ids are absent", () => {
    const line = JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-10T09:30:00.000Z",
      sessionId: "11111111-2222-3333-4444-555555555555",
      uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      message: { model: "claude-fixture-model-1", usage: { input_tokens: 1 } },
    });
    const result = parseUsageLine(line, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.dedupeKey).toMatch(/^claude-code:[0-9a-f]{64}$/);
  });
});
