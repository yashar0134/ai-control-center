import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Strict privacy-filtering parser for Claude Code session-transcript lines
 * (JSONL, format version 2.x as observed in Claude Code 2.1).
 *
 * Transcript records mix usage metadata with conversation content. This parser
 * therefore works by PROJECTION, not by passthrough: after JSON.parse, only an
 * explicitly approved set of metadata fields is copied into a new object, and
 * that projection is validated with Zod. Prompts, responses, tool inputs and
 * outputs, working directories, git branches, and every other unapproved field
 * are never read into the result and are discarded with the parsed line.
 *
 * Approved fields: record type, timestamp, model id, token counts
 * (input/output/cache-creation/cache-read), source version, and the opaque
 * identifiers needed for a content-free dedupe key (message id, request id,
 * session id, record uuid) — which are hashed, never stored verbatim.
 */

/** Metadata-only usage record extracted from one transcript line. */
export interface ClaudeCodeUsageRecord {
  occurredAt: Date;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  /** Pseudonymous, content-free dedupe key (sha-256 of opaque ids). */
  dedupeKey: string;
  /** Claude Code version that wrote the record, when present. */
  sourceVersion: string | null;
}

export type ParseOutcome =
  | { ok: true; record: ClaudeCodeUsageRecord }
  | { ok: false; reason: "not-usage" | "malformed" };

const NOT_USAGE: ParseOutcome = { ok: false, reason: "not-usage" };
const MALFORMED: ParseOutcome = { ok: false, reason: "malformed" };

/** Model ids are plain identifiers; anything else is rejected, never guessed. */
const MODEL_ID_RE = /^[a-z0-9][a-z0-9._:/-]{0,99}$/i;

const tokenField = z.number().int().min(0).optional();

const projectionSchema = z.object({
  timestamp: z.string().min(1),
  model: z.string().regex(MODEL_ID_RE),
  usage: z.object({
    input_tokens: tokenField,
    output_tokens: tokenField,
    cache_creation_input_tokens: tokenField,
    cache_read_input_tokens: tokenField,
  }),
  messageId: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  uuid: z.string().min(1).optional(),
  version: z.string().max(40).optional(),
});

/** Earliest plausible Claude Code record; anything before this is malformed. */
const MIN_TIMESTAMP_MS = Date.UTC(2023, 0, 1);
/** Records may not claim to be from the future (allowing small clock skew). */
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

function asOptionalNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function asOptionalString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Parse one transcript line into a metadata-only usage record.
 * `now` is injected so timestamp validation is deterministic in tests.
 */
export function parseUsageLine(line: string, now: Date): ParseOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return MALFORMED;
  }
  if (typeof raw !== "object" || raw === null) return MALFORMED;

  const record = raw as Record<string, unknown>;
  // Only assistant records carry API usage; every other record type
  // (user, attachment, system, queue-operation, …) is skipped unread.
  if (record.type !== "assistant") return NOT_USAGE;

  const message = record.message;
  if (typeof message !== "object" || message === null) return MALFORMED;
  const msg = message as Record<string, unknown>;

  const usage = msg.usage;
  // Assistant records without a usage block report no token metadata — skip.
  if (typeof usage !== "object" || usage === null) return NOT_USAGE;
  const u = usage as Record<string, unknown>;

  // Synthetic placeholder records (e.g. error stubs) are not real API usage.
  if (msg.model === "<synthetic>") return NOT_USAGE;

  // Explicit projection: ONLY these fields leave the parsed line.
  const projection = {
    timestamp: typeof record.timestamp === "string" ? record.timestamp : "",
    model: typeof msg.model === "string" ? msg.model : "",
    usage: {
      input_tokens: asOptionalNumber(u.input_tokens),
      output_tokens: asOptionalNumber(u.output_tokens),
      cache_creation_input_tokens: asOptionalNumber(u.cache_creation_input_tokens),
      cache_read_input_tokens: asOptionalNumber(u.cache_read_input_tokens),
    },
    messageId: asOptionalString(msg.id),
    requestId: asOptionalString(record.requestId),
    sessionId: asOptionalString(record.sessionId),
    uuid: asOptionalString(record.uuid),
    version: asOptionalString(record.version),
  };

  const parsed = projectionSchema.safeParse(projection);
  if (!parsed.success) return MALFORMED;

  const occurredAt = new Date(parsed.data.timestamp);
  if (
    Number.isNaN(occurredAt.getTime()) ||
    occurredAt.getTime() < MIN_TIMESTAMP_MS ||
    occurredAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS
  ) {
    return MALFORMED;
  }

  const dedupeKey = buildDedupeKey(parsed.data);
  if (!dedupeKey) return MALFORMED;

  return {
    ok: true,
    record: {
      occurredAt,
      model: parsed.data.model,
      inputTokens: parsed.data.usage.input_tokens ?? null,
      outputTokens: parsed.data.usage.output_tokens ?? null,
      cacheCreationTokens: parsed.data.usage.cache_creation_input_tokens ?? null,
      cacheReadTokens: parsed.data.usage.cache_read_input_tokens ?? null,
      dedupeKey,
      sourceVersion: parsed.data.version ?? null,
    },
  };
}

/**
 * Content-free pseudonymous dedupe key.
 *
 * One API response can be written as several transcript lines (one per content
 * block) that repeat the same message id, request id, and usage — keying on
 * message id + request id both prevents double counting within a session and
 * keeps re-imports idempotent. Records without those ids fall back to the
 * session id + record uuid. The raw identifiers are hashed and never stored.
 */
function buildDedupeKey(d: {
  messageId?: string;
  requestId?: string;
  sessionId?: string;
  uuid?: string;
}): string | null {
  const identity =
    d.messageId && d.requestId
      ? `msg:${d.messageId}:${d.requestId}`
      : d.sessionId && d.uuid
        ? `rec:${d.sessionId}:${d.uuid}`
        : null;
  if (!identity) return null;
  const hash = createHash("sha256").update(identity).digest("hex");
  return `claude-code:${hash}`;
}
