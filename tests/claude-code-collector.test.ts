import { describe, expect, it } from "vitest";
import type {
  ClaudeCodeSessionFile,
  ClaudeCodeUsageSource,
} from "@/server/collectors/claude-code/contracts";
import { createClaudeCodeCollector } from "@/server/collectors/claude-code/claude-code-collector";
import { CollectorError, toCollectorError } from "@/server/collectors/errors";
import { splitFreshObservations, observationDedupeKey } from "@/server/collectors/dedupe";
import { normalizeUsageObservation } from "@/server/collectors/normalize";
import type { CollectorContext, UsageObservation } from "@/server/collectors/contracts";

/**
 * Collector tests run against a fully synthetic in-memory source — no real
 * files, no real Claude Code data, no platform dependence. All fixture lines
 * are fictional and metadata-only (fake "content" exists only to prove it is
 * discarded).
 */

const NOW = new Date("2026-07-17T12:00:00Z");
const ctx: CollectorContext = { now: NOW, targetDate: "2026-07-17", currency: "USD" };

let fixtureCounter = 0;
function usageLine(overrides: { model?: string; requestId?: string; input?: number; output?: number } = {}): string {
  fixtureCounter += 1;
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-07-10T09:30:00.000Z",
    sessionId: "11111111-2222-3333-4444-555555555555",
    requestId: overrides.requestId ?? `req_fixture${fixtureCounter}`,
    uuid: `aaaaaaaa-bbbb-cccc-dddd-${String(fixtureCounter).padStart(12, "0")}`,
    version: "9.9.9-fixture",
    cwd: "Z:\\fictional\\secret-project-path",
    message: {
      id: overrides.requestId ? "msg_shared" : `msg_fixture${fixtureCounter}`,
      model: overrides.model ?? "claude-fixture-model-1",
      content: [{ type: "text", text: "FIXTURE_TEXT_MUST_NEVER_SURVIVE" }],
      usage: {
        input_tokens: overrides.input ?? 10,
        output_tokens: overrides.output ?? 20,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 40,
      },
    },
  });
}

class FakeSource implements ClaudeCodeUsageSource {
  public receivedMaxBytes: number[] = [];
  constructor(
    private files: { ref: ClaudeCodeSessionFile; lines: string[] }[],
    private dataDirFound = true,
  ) {}
  async detect() {
    return { dataDirFound: this.dataDirFound, sessionFileCount: this.files.length };
  }
  async listSessionFiles() {
    return this.files.map((f) => f.ref);
  }
  async *readSessionLines(fileId: string, maxBytes: number) {
    this.receivedMaxBytes.push(maxBytes);
    const file = this.files.find((f) => f.ref.id === fileId);
    for (const line of file?.lines ?? []) yield line;
  }
}

function fileRef(id: string, modifiedAt: Date, sizeBytes = 1000): ClaudeCodeSessionFile {
  return { id, sizeBytes, modifiedAt };
}

async function expectCollectorError(promise: Promise<unknown>, category: string) {
  try {
    await promise;
    expect.fail("expected a CollectorError");
  } catch (err) {
    expect(err).toBeInstanceOf(CollectorError);
    expect((err as CollectorError).category).toBe(category);
  }
}

describe("source detection", () => {
  it("reports not-installed when no Claude Code data directory exists", async () => {
    const collector = createClaudeCodeCollector(new FakeSource([], false));
    await expectCollectorError(collector.collect(ctx), "not-installed");
  });

  it("reports source-not-found when the directory exists but has no sessions", async () => {
    const collector = createClaudeCodeCollector(new FakeSource([]));
    await expectCollectorError(collector.collect(ctx), "source-not-found");
  });
});

describe("a detected, supported source", () => {
  it("produces locally-observed usage observations plus a health observation", async () => {
    const source = new FakeSource([
      { ref: fileRef("f1", new Date("2026-07-01")), lines: [usageLine(), usageLine()] },
    ]);
    const collector = createClaudeCodeCollector(source);
    const result = await collector.collect(ctx);

    const usage = result.observations.filter((o) => o.type === "usage");
    const health = result.observations.filter((o) => o.type === "health");
    expect(usage).toHaveLength(2);
    expect(health).toHaveLength(1);
    for (const u of usage) {
      expect(u.connectionId).toBe("claude-code");
      expect(u.provenance).toBe("locally-observed");
    }
    expect(health[0].provenance).toBe("locally-observed");
    expect(result.notes?.join(" ")).toContain("2 usage records");
  });

  it("extracts input/output/cache tokens and derives totals truthfully", async () => {
    const source = new FakeSource([
      { ref: fileRef("f1", new Date("2026-07-01")), lines: [usageLine({ input: 7, output: 11 })] },
    ]);
    const collector = createClaudeCodeCollector(source);
    const result = await collector.collect(ctx);
    const usage = result.observations.find((o) => o.type === "usage") as UsageObservation;
    expect(usage.inputTokens).toBe(7);
    expect(usage.outputTokens).toBe(11);
    expect(usage.cacheCreationTokens).toBe(30);
    expect(usage.cacheReadTokens).toBe(40);
    expect(usage.costAmount).toBeNull(); // never a fabricated cost
    const normalized = normalizeUsageObservation(usage);
    expect(normalized.totalTokens).toBe(18); // input + output, cache kept separate
  });

  it("never leaks content, paths, or raw ids into observations", async () => {
    const source = new FakeSource([
      { ref: fileRef("f1", new Date("2026-07-01")), lines: [usageLine()] },
    ]);
    const collector = createClaudeCodeCollector(source);
    const result = await collector.collect(ctx);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("FIXTURE_TEXT_MUST_NEVER_SURVIVE");
    expect(serialized).not.toContain("secret-project-path");
    expect(serialized).not.toContain("msg_fixture");
    expect(serialized).not.toContain("11111111-2222-3333-4444-555555555555");
  });

  it("survives malformed records mid-file and counts them honestly", async () => {
    const source = new FakeSource([
      {
        ref: fileRef("f1", new Date("2026-07-01")),
        lines: [usageLine(), "{broken json", JSON.stringify({ type: "user", message: "x" }), usageLine()],
      },
    ]);
    const collector = createClaudeCodeCollector(source);
    const result = await collector.collect(ctx);
    expect(result.observations.filter((o) => o.type === "usage")).toHaveLength(2);
    expect(result.notes?.join(" ")).toContain("1 rejected");
  });

  it("collapses repeated stream lines of one API response into one event", async () => {
    const repeated = usageLine({ requestId: "req_shared" });
    const source = new FakeSource([
      { ref: fileRef("f1", new Date("2026-07-01")), lines: [repeated, repeated, repeated] },
    ]);
    const collector = createClaudeCodeCollector(source);
    const result = await collector.collect(ctx);
    expect(result.observations.filter((o) => o.type === "usage")).toHaveLength(1);
  });
});

describe("dedupe and incremental import", () => {
  it("re-running the collector yields identical dedupe keys (zero fresh rows)", async () => {
    const lines = [usageLine(), usageLine()];
    const makeCollector = () =>
      createClaudeCodeCollector(
        new FakeSource([{ ref: fileRef("f1", new Date("2026-07-01")), lines }]),
      );
    const first = await makeCollector().collect(ctx);
    const second = await makeCollector().collect(ctx);

    const firstUsage = first.observations.filter((o) => o.type === "usage");
    const existingKeys = new Set(firstUsage.map(observationDedupeKey));
    const { fresh, skipped } = splitFreshObservations(
      second.observations.filter((o) => o.type === "usage"),
      existingKeys,
    );
    expect(fresh).toHaveLength(0);
    expect(skipped).toBe(firstUsage.length);
  });

  it("imports only newly appended events on the next run", async () => {
    const original = [usageLine(), usageLine()];
    const first = await createClaudeCodeCollector(
      new FakeSource([{ ref: fileRef("f1", new Date("2026-07-01")), lines: original }]),
    ).collect(ctx);

    const appended = [...original, usageLine({ requestId: "req_new_event" })];
    const second = await createClaudeCodeCollector(
      new FakeSource([{ ref: fileRef("f1", new Date("2026-07-02")), lines: appended }]),
    ).collect(ctx);

    const existingKeys = new Set(
      first.observations.filter((o) => o.type === "usage").map(observationDedupeKey),
    );
    const { fresh, skipped } = splitFreshObservations(
      second.observations.filter((o) => o.type === "usage"),
      existingKeys,
    );
    expect(fresh).toHaveLength(1);
    expect(skipped).toBe(2);
  });
});

describe("limits", () => {
  it("stops at the record cap and says so", async () => {
    const source = new FakeSource([
      {
        ref: fileRef("f1", new Date("2026-07-01")),
        lines: [usageLine(), usageLine(), usageLine(), usageLine()],
      },
    ]);
    const collector = createClaudeCodeCollector(source, { maxRecordsPerRun: 2 });
    const result = await collector.collect(ctx);
    expect(result.observations.filter((o) => o.type === "usage")).toHaveLength(2);
    expect(result.notes?.join(" ")).toContain("limit");
  });

  it("scans only the most recent files beyond the file cap", async () => {
    const source = new FakeSource([
      { ref: fileRef("old", new Date("2026-06-01")), lines: [usageLine({ model: "claude-fixture-old" })] },
      { ref: fileRef("mid", new Date("2026-06-15")), lines: [usageLine({ model: "claude-fixture-mid" })] },
      { ref: fileRef("new", new Date("2026-07-01")), lines: [usageLine({ model: "claude-fixture-new" })] },
    ]);
    const collector = createClaudeCodeCollector(source, { maxFiles: 2 });
    const result = await collector.collect(ctx);
    const models = result.observations
      .filter((o): o is UsageObservation => o.type === "usage")
      .map((u) => u.model);
    expect(models).toEqual(["claude-fixture-mid", "claude-fixture-new"]);
    expect(result.notes?.join(" ")).toContain("1 older session file");
  });

  it("passes the per-file byte cap down to the source", async () => {
    const source = new FakeSource([
      { ref: fileRef("f1", new Date("2026-07-01")), lines: [usageLine()] },
    ]);
    const collector = createClaudeCodeCollector(source, { maxBytesPerFile: 4096 });
    await collector.collect(ctx);
    expect(source.receivedMaxBytes).toEqual([4096]);
  });

  it("maps a hung source to a timeout error via the hard run bound", async () => {
    const hangingSource: ClaudeCodeUsageSource = {
      detect: () => new Promise(() => undefined), // never resolves
      listSessionFiles: async () => [],
      // eslint-disable-next-line require-yield
      readSessionLines: async function* () {
        return;
      },
    };
    const collector = createClaudeCodeCollector(hangingSource, { timeoutMs: 20 });
    await expectCollectorError(collector.collect(ctx), "timeout");
  });
});

describe("error mapping for local-source failures", () => {
  it("maps permission errors to permission-denied without leaking details", () => {
    const err = toCollectorError(Object.assign(new Error("EACCES: /very/private/path"), { code: "EACCES" }));
    expect(err.category).toBe("permission-denied");
    expect(err.safeMessage).not.toContain("private");
  });

  it("maps busy-file errors to source-busy", () => {
    const err = toCollectorError(Object.assign(new Error("EBUSY: locked"), { code: "EBUSY" }));
    expect(err.category).toBe("source-busy");
  });
});
