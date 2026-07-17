import type {
  Collector,
  CollectorContext,
  CollectorResult,
  HealthObservation,
  Observation,
  UsageObservation,
} from "../contracts";
import { CollectorError, withTimeout } from "../errors";
import type { ClaudeCodeUsageSource } from "./contracts";
import { parseUsageLine, type ClaudeCodeUsageRecord } from "./parser";
import { realClaudeCodeSource } from "./real-source";

/**
 * Claude Code local usage collector.
 *
 * Reads usage METADATA (timestamps, model ids, token counts) from local Claude
 * Code session transcripts through the injectable source boundary, filters it
 * through the strict projection parser, and reports normalized observations
 * with provenance "locally-observed". Prompts, responses, file names, project
 * names, and paths never enter an observation — see parser.ts.
 *
 * Import is MANUAL (user-triggered) and incremental by design: every record
 * carries a deterministic content-free dedupe key, so re-running the import
 * writes zero duplicates and newly appended records are picked up by a bounded
 * re-scan. No cursor is persisted (a cursor would have to reference file
 * paths, which are private).
 */

export const CLAUDE_CODE_CONNECTION_ID = "claude-code";
export const CLAUDE_CODE_COLLECTOR_ID = "claude-code-local";

export interface ClaudeImportLimits {
  /** Most-recently-modified session files scanned per run. */
  maxFiles: number;
  /** Hard byte cap per session file; lines beyond it are not read. */
  maxBytesPerFile: number;
  /** Parsed usage records per run (after in-run dedupe). */
  maxRecordsPerRun: number;
  /** Hard wall-clock bound for one import run. */
  timeoutMs: number;
}

export const CLAUDE_IMPORT_LIMITS: ClaudeImportLimits = {
  maxFiles: 500,
  maxBytesPerFile: 512 * 1024 * 1024,
  maxRecordsPerRun: 100_000,
  timeoutMs: 120_000,
};

export interface ClaudeImportStats {
  filesScanned: number;
  filesSkipped: number;
  linesRead: number;
  usageRecords: number;
  duplicateStreamLines: number;
  nonUsageLines: number;
  malformedLines: number;
  limitReached: boolean;
  sourceVersion: string | null;
}

async function collectFromSource(
  source: ClaudeCodeUsageSource,
  ctx: CollectorContext,
  limits: ClaudeImportLimits,
): Promise<CollectorResult> {
  const detection = await source.detect();
  if (!detection.dataDirFound) {
    throw new CollectorError(
      "not-installed",
      "No local Claude Code data was found on this machine. Install Claude Code and use it at least once, then import again.",
    );
  }
  if (detection.sessionFileCount === 0) {
    throw new CollectorError(
      "source-not-found",
      "Claude Code is present but has no session data yet. Use Claude Code, then import again.",
    );
  }

  const allFiles = await source.listSessionFiles();
  // Oldest first so history imports in order; cap keeps runs bounded.
  allFiles.sort((a, b) => a.modifiedAt.getTime() - b.modifiedAt.getTime());
  const files =
    allFiles.length > limits.maxFiles
      ? allFiles.slice(allFiles.length - limits.maxFiles)
      : allFiles;

  const stats: ClaudeImportStats = {
    filesScanned: 0,
    filesSkipped: allFiles.length - files.length,
    linesRead: 0,
    usageRecords: 0,
    duplicateStreamLines: 0,
    nonUsageLines: 0,
    malformedLines: 0,
    limitReached: false,
    sourceVersion: null,
  };

  const records = new Map<string, ClaudeCodeUsageRecord>();

  for (const file of files) {
    if (records.size >= limits.maxRecordsPerRun) {
      stats.limitReached = true;
      break;
    }
    stats.filesScanned += 1;
    for await (const line of source.readSessionLines(file.id, limits.maxBytesPerFile)) {
      stats.linesRead += 1;
      const outcome = parseUsageLine(line, ctx.now);
      if (!outcome.ok) {
        if (outcome.reason === "not-usage") stats.nonUsageLines += 1;
        else stats.malformedLines += 1;
        continue;
      }
      if (records.has(outcome.record.dedupeKey)) {
        // Streaming writes repeat one API response across several lines with
        // identical usage — counting it once is the truthful number.
        stats.duplicateStreamLines += 1;
        continue;
      }
      records.set(outcome.record.dedupeKey, outcome.record);
      if (outcome.record.sourceVersion) {
        stats.sourceVersion = outcome.record.sourceVersion;
      }
      if (records.size >= limits.maxRecordsPerRun) {
        stats.limitReached = true;
        break;
      }
    }
  }
  stats.usageRecords = records.size;

  const observations: Observation[] = [...records.values()].map(
    (r): UsageObservation => ({
      type: "usage",
      connectionId: CLAUDE_CODE_CONNECTION_ID,
      dedupeKey: r.dedupeKey,
      occurredAt: r.occurredAt,
      eventType: "assistant-turn",
      model: r.model,
      status: "ok",
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      totalTokens: null, // derived truthfully from input + output in normalize
      cacheCreationTokens: r.cacheCreationTokens,
      cacheReadTokens: r.cacheReadTokens,
      costAmount: null, // provider-billed cost is not available locally
      costKind: null,
      provenance: "locally-observed",
    }),
  );

  const health: HealthObservation = {
    type: "health",
    subjectType: "connection",
    subjectId: CLAUDE_CODE_CONNECTION_ID,
    connectionId: CLAUDE_CODE_CONNECTION_ID,
    capturedAt: ctx.now,
    status: stats.malformedLines > 0 ? "degraded" : "ok",
    provenance: "locally-observed",
    metrics: {
      sessionFiles: stats.filesScanned,
      usageRecords: stats.usageRecords,
      rejectedLines: stats.malformedLines,
      ...(stats.sourceVersion ? { sourceVersion: stats.sourceVersion } : {}),
    },
  };
  observations.push(health);

  const notes = [
    `Scanned ${stats.filesScanned} session file${stats.filesScanned === 1 ? "" : "s"}: ` +
      `${stats.usageRecords} usage records parsed, ` +
      `${stats.malformedLines} rejected, ` +
      `${stats.nonUsageLines + stats.duplicateStreamLines} skipped (non-usage or repeated stream lines).` +
      (stats.sourceVersion ? ` Source version ${stats.sourceVersion}.` : ""),
  ];
  if (stats.limitReached) {
    notes.push(
      `Import limit of ${limits.maxRecordsPerRun} records per run reached — run the import again to continue.`,
    );
  }
  if (stats.filesSkipped > 0) {
    notes.push(
      `${stats.filesSkipped} older session file${stats.filesSkipped === 1 ? "" : "s"} beyond the ${limits.maxFiles}-file limit were not scanned.`,
    );
  }

  return { observations, notes };
}

/** Factory so tests can inject a synthetic source and tightened limits. */
export function createClaudeCodeCollector(
  source: ClaudeCodeUsageSource,
  limitOverrides: Partial<ClaudeImportLimits> = {},
): Collector {
  const limits: ClaudeImportLimits = { ...CLAUDE_IMPORT_LIMITS, ...limitOverrides };
  return {
    id: CLAUDE_CODE_COLLECTOR_ID,
    name: "Claude Code local usage",
    description:
      "Imports usage metadata (timestamps, model ids, token counts) from Claude Code's local session records. Manual import — nothing runs in the background and nothing leaves this machine.",
    method: "local-file",
    connectionIds: [CLAUDE_CODE_CONNECTION_ID],
    requiresElevation: false,
    status: "implemented",
    enabledSettingKey: "claudeCodeImportEnabled",
    privacyNotes:
      "Reads only usage metadata from local Claude Code session records: timestamps, model identifiers, and token counts. Prompts, responses, source code, file names, project names, and directory paths are never read into the result, persisted, or displayed. Duplicate-safe: re-importing writes nothing twice.",
    collect(ctx: CollectorContext): Promise<CollectorResult> {
      return withTimeout(collectFromSource(source, ctx, limits), limits.timeoutMs);
    },
  };
}

export const claudeCodeCollector = createClaudeCodeCollector(realClaudeCodeSource);
