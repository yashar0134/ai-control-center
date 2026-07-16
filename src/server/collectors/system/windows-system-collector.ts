import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  Collector,
  CollectorContext,
  CollectorResult,
  HealthObservation,
} from "../contracts";
import { CollectorError, toCollectorError, withTimeout } from "../errors";
import {
  computeCpuPercent,
  computeNetworkThroughput,
  normalizeDisk,
  normalizeMemory,
  parseNetworkProbe,
  type CpuTimesSample,
  type StatfsLike,
  type SystemMetrics,
} from "./metrics";

/**
 * Real Windows system collector.
 *
 * Reads ONLY aggregate machine health: CPU utilization (from two bounded
 * os.cpus() samples), memory totals (os.totalmem/freemem), capacity of the
 * volume hosting the app (fs.statfs — a capacity API, no file enumeration),
 * and aggregate network throughput (one fixed, non-interactive PowerShell
 * probe of cumulative byte counters, sampled twice inside a single process).
 *
 * It never reads files, process lists, adapter identifiers for storage,
 * usernames, hostnames, or any machine-identifying value, and it requires no
 * administrator privileges. Raw probe output is parsed, validated with Zod,
 * and discarded.
 */

/** Hard upper bound for a complete collector run. */
export const SYSTEM_COLLECTOR_TIMEOUT_MS = 8000;
/** Internal sampling window shared by CPU and network measurement. */
const SAMPLE_WINDOW_MS = 700;
/** PowerShell probe process timeout (must stay under the hard bound). */
const PROBE_TIMEOUT_MS = 5000;
const PROBE_MAX_BUFFER = 1024 * 1024; // 1 MiB output cap

/**
 * Fixed, non-interactive network probe. No user input is ever interpolated.
 * It samples cumulative per-interface byte counters twice and reports the
 * measured interval; all math happens in Node after Zod validation.
 */
const NETWORK_PROBE_SCRIPT = [
  "$ErrorActionPreference='Stop';",
  "$ProgressPreference='SilentlyContinue';",
  "function Snap { @(Get-CimInstance -ClassName Win32_PerfRawData_Tcpip_NetworkInterface |",
  "  Select-Object Name,BytesReceivedPersec,BytesSentPersec) }",
  "$a=Snap;",
  "$sw=[System.Diagnostics.Stopwatch]::StartNew();",
  `Start-Sleep -Milliseconds ${SAMPLE_WINDOW_MS};`,
  "$b=Snap;",
  "$sw.Stop();",
  // Re-wrap with @() — PowerShell's pipeline unwraps single-element arrays on
  // function return, which would otherwise serialize as a bare object.
  "@{a=@($a);b=@($b);elapsedMs=$sw.ElapsedMilliseconds}|ConvertTo-Json -Compress -Depth 4",
].join(" ");

/**
 * Platform boundary. The real implementation touches the OS; tests inject a
 * fake so no test depends on real hardware or executes real PowerShell.
 */
export interface SystemHost {
  platform: NodeJS.Platform;
  cpus(): CpuTimesSample[];
  logicalCpuCount(): number;
  totalmem(): number;
  freemem(): number;
  /** Capacity of the volume hosting the application; null when unsupported. */
  statfsAppVolume(): Promise<StatfsLike | null>;
  /** Raw JSON from the fixed network probe. Rejects on process failure. */
  runNetworkProbe(): Promise<string>;
  sleep(ms: number): Promise<void>;
}

export const realSystemHost: SystemHost = {
  platform: process.platform,
  cpus: () => os.cpus().map((c) => ({ ...c.times })),
  logicalCpuCount: () => os.cpus().length,
  totalmem: () => os.totalmem(),
  freemem: () => os.freemem(),
  async statfsAppVolume() {
    try {
      // Root of the volume the app runs from. The path itself is never stored.
      const root = path.parse(process.cwd()).root;
      const s = await fs.statfs(root);
      return { bsize: s.bsize, blocks: s.blocks, bfree: s.bfree, bavail: s.bavail };
    } catch {
      return null;
    }
  },
  runNetworkProbe() {
    return new Promise<string>((resolve, reject) => {
      execFile(
        "powershell.exe",
        // Fixed argument array — nothing user-controlled, no shell string.
        ["-NoProfile", "-NonInteractive", "-Command", NETWORK_PROBE_SCRIPT],
        { timeout: PROBE_TIMEOUT_MS, maxBuffer: PROBE_MAX_BUFFER, windowsHide: true },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        },
      );
    });
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Core measurement, separated for testing with a fake host. */
export async function measureWindowsSystem(
  host: SystemHost,
  capturedAt: Date,
): Promise<{ observation: HealthObservation; notes: string[] }> {
  if (host.platform !== "win32") {
    throw new CollectorError(
      "unsupported-platform",
      "Real system collection currently supports Windows only.",
    );
  }

  const started = Date.now();
  const notes: string[] = [];

  // Shared sampling window: CPU sample A, then the network probe (which
  // sleeps internally), then CPU sample B.
  const cpuA = host.cpus();
  const probePromise = host.runNetworkProbe().then(
    (raw) => ({ ok: true as const, raw }),
    (err) => ({ ok: false as const, err }),
  );
  const diskPromise = host.statfsAppVolume();
  await host.sleep(SAMPLE_WINDOW_MS);
  const [probe, statfs] = await Promise.all([probePromise, diskPromise]);
  const cpuB = host.cpus();

  const metrics: SystemMetrics = { osFamily: "windows" };

  const cpuPercent = computeCpuPercent(cpuA, cpuB);
  if (cpuPercent === null) {
    notes.push("CPU utilization unavailable (metric-unavailable).");
  } else {
    metrics.cpuPercent = cpuPercent;
    metrics.cpuCount = host.logicalCpuCount();
  }

  const memory = normalizeMemory(host.totalmem(), host.freemem());
  if (memory === null) {
    notes.push("Memory metrics unavailable (metric-unavailable).");
  } else {
    metrics.memoryTotalBytes = memory.totalBytes;
    metrics.memoryUsedBytes = memory.usedBytes;
    metrics.memoryFreeBytes = memory.freeBytes;
    metrics.memoryPercent = memory.percent;
  }

  const disk = normalizeDisk(statfs);
  if (disk === null) {
    notes.push("Disk metrics unavailable (metric-unavailable).");
  } else {
    metrics.diskTotalBytes = disk.totalBytes;
    metrics.diskUsedBytes = disk.usedBytes;
    metrics.diskFreeBytes = disk.freeBytes;
    metrics.diskPercent = disk.percent;
  }

  if (probe.ok) {
    try {
      const throughput = computeNetworkThroughput(parseNetworkProbe(probe.raw));
      if (throughput === null) {
        notes.push("Network throughput unavailable (metric-unavailable).");
      } else {
        metrics.networkDownBytesPerSec = throughput.downBytesPerSec;
        metrics.networkUpBytesPerSec = throughput.upBytesPerSec;
      }
    } catch (err) {
      notes.push(`Network throughput unavailable (${toCollectorError(err).category}).`);
    }
  } else {
    notes.push(`Network throughput unavailable (${toCollectorError(probe.err).category}).`);
  }

  metrics.collectionDurationMs = Date.now() - started;

  const coreMetricsPresent =
    metrics.cpuPercent !== undefined && metrics.memoryTotalBytes !== undefined;

  const observation: HealthObservation = {
    type: "health",
    subjectType: "machine",
    subjectId: "local-machine",
    connectionId: null,
    capturedAt,
    status: coreMetricsPresent ? (notes.length > 0 ? "degraded" : "ok") : "degraded",
    provenance: "locally-observed",
    metrics: metrics as unknown as Record<string, number | string>,
  };

  return { observation, notes };
}

export const windowsSystemCollector: Collector = {
  id: "windows-system",
  name: "Windows system monitor",
  description:
    "Measures real aggregate CPU, memory, disk capacity, and network throughput on this Windows machine. One-shot measurement on demand — no background monitoring.",
  method: "local-process",
  connectionIds: [],
  platforms: ["win32"],
  requiresElevation: false,
  status: "implemented",
  privacyNotes:
    "Collects only aggregate machine totals: CPU %, memory bytes, disk capacity of the app's volume, and summed network throughput. Never reads files, file names, processes, adapter identifiers, usernames, hostname, or any machine-identifying value. No administrator rights. Raw probe output is validated and discarded — never stored.",
  async collect(ctx: CollectorContext): Promise<CollectorResult> {
    const { observation, notes } = await withTimeout(
      measureWindowsSystem(realSystemHost, ctx.now),
      SYSTEM_COLLECTOR_TIMEOUT_MS,
    );
    return { observations: [observation], notes };
  },
};
