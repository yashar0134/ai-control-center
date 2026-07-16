import { z } from "zod";
import { CollectorError } from "../errors";

/**
 * Pure, hardware-independent metric math for the Windows system collector.
 * Everything here is deterministic given its inputs and fully unit-testable.
 *
 * Unit conventions (documented in docs/ARCHITECTURE.md and the UI):
 *  - memory/disk are stored as BYTES (numbers), displayed as GiB (1 GiB = 1024³ bytes)
 *  - network throughput is stored as BYTES PER SECOND, displayed as Mbps (1 Mbps = 10⁶ bits/s)
 *  - percentages are 0–100 with one decimal
 * Invalid or impossible readings return null (unknown) — never a fake number.
 */

export interface CpuTimesSample {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

/**
 * Aggregate CPU utilization from two `os.cpus()` samples taken a short,
 * bounded interval apart (busy-time delta ÷ total-time delta across all
 * logical cores). This is a real utilization measurement, not a load average.
 */
export function computeCpuPercent(
  a: CpuTimesSample[],
  b: CpuTimesSample[],
): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < a.length; i++) {
    const dUser = b[i].user - a[i].user;
    const dNice = b[i].nice - a[i].nice;
    const dSys = b[i].sys - a[i].sys;
    const dIdle = b[i].idle - a[i].idle;
    const dIrq = b[i].irq - a[i].irq;
    const dTotal = dUser + dNice + dSys + dIdle + dIrq;
    if (
      ![dUser, dNice, dSys, dIdle, dIrq].every(Number.isFinite) ||
      dTotal < 0 ||
      dIdle < 0
    ) {
      return null;
    }
    idleDelta += dIdle;
    totalDelta += dTotal;
  }
  if (totalDelta <= 0) return null;
  const pct = (1 - idleDelta / totalDelta) * 100;
  return clampPercent(pct);
}

export interface MemoryMetrics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  percent: number;
}

export function normalizeMemory(
  totalBytes: number,
  freeBytes: number,
): MemoryMetrics | null {
  if (!Number.isFinite(totalBytes) || !Number.isFinite(freeBytes)) return null;
  if (totalBytes <= 0 || freeBytes < 0) return null;
  const free = Math.min(freeBytes, totalBytes); // used may never exceed total
  const used = totalBytes - free;
  return {
    totalBytes,
    usedBytes: used,
    freeBytes: free,
    percent: clampPercent((used / totalBytes) * 100) ?? 0,
  };
}

export interface StatfsLike {
  bsize: number;
  blocks: number;
  bfree: number;
  bavail: number;
}

export interface DiskMetrics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  percent: number;
}

/**
 * Aggregate capacity of the volume hosting the application, from an OS
 * capacity API (`fs.statfs`) only — no directory enumeration, ever.
 */
export function normalizeDisk(s: StatfsLike | null): DiskMetrics | null {
  if (!s) return null;
  const { bsize, blocks, bfree, bavail } = s;
  if (![bsize, blocks, bfree, bavail].every((v) => Number.isFinite(v) && v >= 0)) {
    return null;
  }
  const totalBytes = bsize * blocks;
  if (totalBytes <= 0) return null;
  const freeBytes = Math.min(bsize * bavail, totalBytes);
  const usedBytes = Math.max(totalBytes - bsize * bfree, 0);
  return {
    totalBytes,
    usedBytes: Math.min(usedBytes, totalBytes),
    freeBytes,
    percent: clampPercent((Math.min(usedBytes, totalBytes) / totalBytes) * 100) ?? 0,
  };
}

/**
 * Shape of the fixed PowerShell network probe output: two samples of
 * cumulative per-interface byte counters plus the measured interval.
 * Interface names are used ONLY to pair samples and exclude virtual/loopback
 * interfaces — they are discarded immediately after this computation and are
 * never persisted or displayed.
 */
const counterSchema = z.object({
  Name: z.string(),
  BytesReceivedPersec: z.coerce.number().finite().min(0),
  BytesSentPersec: z.coerce.number().finite().min(0),
});

// PowerShell 5.1 serializes a single-element result as a bare object rather
// than a one-element array; normalize both shapes before validation.
const counterListSchema = z.preprocess(
  (v) => (Array.isArray(v) ? v : v === null || v === undefined ? [] : [v]),
  z.array(counterSchema),
);

export const networkProbeSchema = z.object({
  a: counterListSchema,
  b: counterListSchema,
  elapsedMs: z.coerce.number().finite().positive(),
});

export type NetworkProbePayload = z.infer<typeof networkProbeSchema>;

/** Parse and validate raw probe JSON. Throws a safe CollectorError on garbage. */
export function parseNetworkProbe(raw: string): NetworkProbePayload {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new CollectorError(
      "malformed-output",
      "The network probe returned data in an unexpected format.",
    );
  }
  const result = networkProbeSchema.safeParse(json);
  if (!result.success) {
    throw new CollectorError(
      "malformed-output",
      "The network probe returned data in an unexpected format.",
    );
  }
  return result.data;
}

const EXCLUDED_INTERFACE = /loopback|isatap|teredo/i;

export interface NetworkMetrics {
  downBytesPerSec: number;
  upBytesPerSec: number;
}

/**
 * Aggregate throughput from two cumulative counter samples. Loopback and
 * tunnel pseudo-interfaces are excluded. Per-interface counter resets
 * (negative deltas) are clamped to zero rather than inventing values.
 * Returns null when no eligible interface exists.
 */
export function computeNetworkThroughput(
  p: NetworkProbePayload,
): NetworkMetrics | null {
  const second = new Map(p.b.map((s) => [s.Name, s]));
  let rxDelta = 0;
  let txDelta = 0;
  let eligible = 0;
  for (const first of p.a) {
    if (EXCLUDED_INTERFACE.test(first.Name)) continue;
    const after = second.get(first.Name);
    if (!after) continue;
    eligible += 1;
    rxDelta += Math.max(after.BytesReceivedPersec - first.BytesReceivedPersec, 0);
    txDelta += Math.max(after.BytesSentPersec - first.BytesSentPersec, 0);
  }
  if (eligible === 0) return null;
  const seconds = p.elapsedMs / 1000;
  return {
    downBytesPerSec: Math.round(rxDelta / seconds),
    upBytesPerSec: Math.round(txDelta / seconds),
  };
}

function clampPercent(v: number): number | null {
  if (!Number.isFinite(v)) return null;
  return Math.round(Math.min(Math.max(v, 0), 100) * 10) / 10;
}

/**
 * The complete, validated shape of a real system snapshot's metrics as stored
 * in HealthSnapshot.metricsJson. Unavailable metrics are ABSENT, never zero.
 */
export const systemMetricsSchema = z.object({
  osFamily: z.literal("windows"),
  cpuPercent: z.number().min(0).max(100).optional(),
  cpuCount: z.number().int().positive().optional(),
  memoryTotalBytes: z.number().positive().optional(),
  memoryUsedBytes: z.number().min(0).optional(),
  memoryFreeBytes: z.number().min(0).optional(),
  memoryPercent: z.number().min(0).max(100).optional(),
  diskTotalBytes: z.number().positive().optional(),
  diskUsedBytes: z.number().min(0).optional(),
  diskFreeBytes: z.number().min(0).optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  networkDownBytesPerSec: z.number().min(0).optional(),
  networkUpBytesPerSec: z.number().min(0).optional(),
  collectionDurationMs: z.number().min(0).optional(),
});

export type SystemMetrics = z.infer<typeof systemMetricsSchema>;
