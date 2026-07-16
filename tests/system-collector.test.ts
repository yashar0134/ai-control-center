import { describe, expect, it } from "vitest";
import {
  computeCpuPercent,
  computeNetworkThroughput,
  normalizeDisk,
  normalizeMemory,
  parseNetworkProbe,
  systemMetricsSchema,
  type CpuTimesSample,
} from "@/server/collectors/system/metrics";
import {
  measureWindowsSystem,
  type SystemHost,
} from "@/server/collectors/system/windows-system-collector";
import { CollectorError, toCollectorError, withTimeout } from "@/server/collectors/errors";
import { RunGate } from "@/server/collectors/run-gate";

const times = (user: number, sys: number, idle: number): CpuTimesSample => ({
  user,
  nice: 0,
  sys,
  idle,
  irq: 0,
});

describe("CPU utilization from sampled CPU times", () => {
  it("computes busy percentage across multiple cores", () => {
    const a = [times(100, 50, 850), times(200, 100, 700)];
    const b = [times(150, 75, 900), times(250, 125, 750)]; // each core: 125 busy delta? core1: 50+25 busy, 50 idle → 100 total
    // core1: busy 75, idle 50, total 125; core2: busy 75, idle 50, total 125 → busy 150/250 = 60%
    expect(computeCpuPercent(a, b)).toBe(60);
  });

  it("returns null (unknown) for invalid samples — never a fake number", () => {
    expect(computeCpuPercent([], [])).toBeNull(); // no cores
    expect(computeCpuPercent([times(1, 1, 1)], [])).toBeNull(); // length mismatch
    expect(computeCpuPercent([times(100, 0, 100)], [times(50, 0, 100)])).toBeNull(); // counter went backwards
    expect(computeCpuPercent([times(1, 1, 1)], [times(1, 1, 1)])).toBeNull(); // zero delta
    expect(
      computeCpuPercent([times(Number.NaN, 0, 0)], [times(1, 0, 0)]),
    ).toBeNull();
  });

  it("stays within 0–100", () => {
    const pct = computeCpuPercent([times(0, 0, 0)], [times(1000, 0, 0)]);
    expect(pct).toBe(100);
  });
});

describe("memory normalization", () => {
  it("computes used/free/percent with used never exceeding total", () => {
    const m = normalizeMemory(32 * 1024 ** 3, 8 * 1024 ** 3);
    expect(m).not.toBeNull();
    expect(m!.usedBytes).toBe(24 * 1024 ** 3);
    expect(m!.percent).toBe(75);
    // free reported above total gets clamped, not negated
    const clamped = normalizeMemory(1000, 2000);
    expect(clamped!.usedBytes).toBe(0);
  });

  it("rejects impossible readings as unknown", () => {
    expect(normalizeMemory(0, 0)).toBeNull();
    expect(normalizeMemory(-1, 5)).toBeNull();
    expect(normalizeMemory(100, -5)).toBeNull();
    expect(normalizeMemory(Number.NaN, 1)).toBeNull();
  });
});

describe("disk normalization", () => {
  it("computes capacity from statfs-style counts only", () => {
    const d = normalizeDisk({ bsize: 4096, blocks: 1000, bfree: 400, bavail: 300 });
    expect(d).not.toBeNull();
    expect(d!.totalBytes).toBe(4096 * 1000);
    expect(d!.freeBytes).toBe(4096 * 300);
    expect(d!.usedBytes).toBe(4096 * 600);
    expect(d!.percent).toBe(60);
  });

  it("returns unknown for missing or invalid data", () => {
    expect(normalizeDisk(null)).toBeNull();
    expect(normalizeDisk({ bsize: 0, blocks: 0, bfree: 0, bavail: 0 })).toBeNull();
    expect(normalizeDisk({ bsize: -1, blocks: 10, bfree: 1, bavail: 1 })).toBeNull();
  });
});

const probePayload = (elapsedMs: number) => ({
  a: [
    { Name: "Ethernet Adapter", BytesReceivedPersec: 1000, BytesSentPersec: 500 },
    { Name: "Loopback Pseudo-Interface 1", BytesReceivedPersec: 0, BytesSentPersec: 0 },
  ],
  b: [
    { Name: "Ethernet Adapter", BytesReceivedPersec: 11000, BytesSentPersec: 3000 },
    { Name: "Loopback Pseudo-Interface 1", BytesReceivedPersec: 999999, BytesSentPersec: 999999 },
  ],
  elapsedMs,
});

describe("network throughput", () => {
  it("computes rates from counter deltas over the measured interval", () => {
    const t = computeNetworkThroughput(probePayload(1000));
    expect(t).toEqual({ downBytesPerSec: 10000, upBytesPerSec: 2500 });
  });

  it("excludes loopback/tunnel pseudo-interfaces", () => {
    const onlyLoopback = {
      a: [{ Name: "Loopback Pseudo-Interface 1", BytesReceivedPersec: 0, BytesSentPersec: 0 }],
      b: [{ Name: "Loopback Pseudo-Interface 1", BytesReceivedPersec: 5000, BytesSentPersec: 5000 }],
      elapsedMs: 1000,
    };
    expect(computeNetworkThroughput(onlyLoopback)).toBeNull();
  });

  it("clamps counter resets to zero instead of inventing values", () => {
    const reset = {
      a: [{ Name: "Ethernet", BytesReceivedPersec: 9999, BytesSentPersec: 9999 }],
      b: [{ Name: "Ethernet", BytesReceivedPersec: 5, BytesSentPersec: 5 }],
      elapsedMs: 1000,
    };
    expect(computeNetworkThroughput(reset)).toEqual({
      downBytesPerSec: 0,
      upBytesPerSec: 0,
    });
  });

  it("parses valid probe JSON (including string numbers)", () => {
    const parsed = parseNetworkProbe(JSON.stringify(probePayload(700)));
    expect(parsed.a).toHaveLength(2);
    const coerced = parseNetworkProbe(
      JSON.stringify({
        a: [{ Name: "X", BytesReceivedPersec: "10", BytesSentPersec: "20" }],
        b: [{ Name: "X", BytesReceivedPersec: "30", BytesSentPersec: "40" }],
        elapsedMs: "500",
      }),
    );
    expect(coerced.elapsedMs).toBe(500);
  });

  it("accepts a single interface serialized as a bare object (PowerShell 5.1 unwrap)", () => {
    const parsed = parseNetworkProbe(
      JSON.stringify({
        a: { Name: "X", BytesReceivedPersec: 100, BytesSentPersec: 50 },
        b: { Name: "X", BytesReceivedPersec: 1100, BytesSentPersec: 550 },
        elapsedMs: 1000,
      }),
    );
    expect(parsed.a).toHaveLength(1);
    expect(computeNetworkThroughput(parsed)).toEqual({
      downBytesPerSec: 1000,
      upBytesPerSec: 500,
    });
  });

  it("rejects malformed output with a safe category", () => {
    for (const bad of ["not json", "{}", '{"a":[],"b":"x","elapsedMs":1}']) {
      try {
        parseNetworkProbe(bad);
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(CollectorError);
        expect((e as CollectorError).category).toBe("malformed-output");
      }
    }
  });
});

describe("safe error mapping", () => {
  it("maps failure modes to safe categories", () => {
    expect(toCollectorError({ code: "ENOENT" }).category).toBe("command-unavailable");
    expect(toCollectorError({ killed: true }).category).toBe("timeout");
    expect(toCollectorError({ code: "EACCES" }).category).toBe("permission-denied");
    expect(toCollectorError(new SyntaxError("x")).category).toBe("malformed-output");
    expect(toCollectorError(new Error("anything")).category).toBe("internal-error");
  });

  it("never leaks the original error text", () => {
    const mapped = toCollectorError(new Error("C:/Users/someone/secret.txt"));
    expect(mapped.safeMessage).not.toContain("secret");
    expect(mapped.safeMessage).not.toContain("C:/");
  });

  it("withTimeout rejects with a timeout category", async () => {
    const never = new Promise(() => undefined);
    await expect(withTimeout(never, 10)).rejects.toMatchObject({ category: "timeout" });
  });
});

function fakeHost(overrides: Partial<SystemHost> = {}): SystemHost {
  let call = 0;
  return {
    platform: "win32",
    cpus: () => {
      call += 1;
      return call === 1 ? [times(100, 50, 850)] : [times(150, 75, 900)];
    },
    logicalCpuCount: () => 8,
    totalmem: () => 32 * 1024 ** 3,
    freemem: () => 8 * 1024 ** 3,
    statfsAppVolume: async () => ({ bsize: 4096, blocks: 1000, bfree: 400, bavail: 300 }),
    runNetworkProbe: async () => JSON.stringify(probePayload(1000)),
    sleep: async () => undefined,
    ...overrides,
  };
}

describe("Windows system collector (fake host — no real hardware)", () => {
  const capturedAt = new Date(2026, 6, 16, 12, 0, 0);

  it("produces a locally-observed machine health observation with validated metrics", async () => {
    const { observation } = await measureWindowsSystem(fakeHost(), capturedAt);
    expect(observation.provenance).toBe("locally-observed");
    expect(observation.subjectType).toBe("machine");
    expect(observation.status).toBe("ok");
    const metrics = systemMetricsSchema.parse(observation.metrics);
    expect(metrics.cpuPercent).toBe(60);
    expect(metrics.cpuCount).toBe(8);
    expect(metrics.memoryPercent).toBe(75);
    expect(metrics.diskPercent).toBe(60);
    expect(metrics.networkDownBytesPerSec).toBe(10000);
  });

  it("throws unsupported-platform on non-Windows instead of faking values", async () => {
    await expect(
      measureWindowsSystem(fakeHost({ platform: "linux" }), capturedAt),
    ).rejects.toMatchObject({ category: "unsupported-platform" });
  });

  it("keeps unavailable metrics absent (unknown), never zero", async () => {
    const host = fakeHost({
      statfsAppVolume: async () => null,
      runNetworkProbe: async () => {
        throw { killed: true }; // probe timed out
      },
    });
    const { observation, notes } = await measureWindowsSystem(host, capturedAt);
    const metrics = systemMetricsSchema.parse(observation.metrics);
    expect(metrics.diskPercent).toBeUndefined();
    expect(metrics.diskUsedBytes).toBeUndefined();
    expect(metrics.networkDownBytesPerSec).toBeUndefined();
    expect(observation.status).toBe("degraded");
    expect(notes.join(" ")).toContain("timeout");
    // CPU and memory still real
    expect(metrics.cpuPercent).toBe(60);
    expect(metrics.memoryTotalBytes).toBe(32 * 1024 ** 3);
  });

  it("never includes identifying values in the stored metrics", async () => {
    const { observation } = await measureWindowsSystem(fakeHost(), capturedAt);
    const keys = Object.keys(observation.metrics ?? {});
    const serialized = JSON.stringify(observation.metrics);
    expect(keys.every((k) => /^(osFamily|cpu|memory|disk|network|collection)/.test(k))).toBe(true);
    expect(serialized).not.toMatch(/Ethernet|Loopback|Name/);
  });
});

describe("duplicate-run gate", () => {
  it("blocks overlapping runs and enforces a cooldown", () => {
    let clock = 1000;
    const gate = new RunGate(5000, () => clock);
    expect(gate.tryAcquire("windows-system")).toEqual({ ok: true });
    expect(gate.tryAcquire("windows-system")).toEqual({ ok: false, reason: "in-flight" });
    gate.release("windows-system");
    expect(gate.tryAcquire("windows-system")).toEqual({ ok: false, reason: "cooldown" });
    clock += 5001;
    expect(gate.tryAcquire("windows-system")).toEqual({ ok: true });
  });

  it("gates collectors independently", () => {
    const gate = new RunGate(5000, () => 0);
    expect(gate.tryAcquire("a")).toEqual({ ok: true });
    expect(gate.tryAcquire("b")).toEqual({ ok: true });
  });
});
