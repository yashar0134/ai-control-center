import type {
  CapabilityDeclaration,
  CollectionMethod,
  ConnectionKind,
  CostKind,
  EventStatus,
  HealthStatus,
  Provenance,
} from "@/server/domain/types";

/**
 * Collector and provider-adapter contracts.
 *
 * A Collector is a source-specific mechanism that produces safe, normalized
 * observations. It never persists anything itself — the collector service
 * validates, de-duplicates, and writes through the data-access layer.
 *
 * These are compile-time contracts wired through a typed registry.
 * There is intentionally no runtime plugin loader.
 */

/** Raw-but-normalized usage reported by a collector. */
export interface UsageObservation {
  type: "usage";
  connectionId: string;
  /** Stable idempotency key. Re-collecting the same source data must produce the same key. */
  dedupeKey: string;
  occurredAt: Date;
  eventType: string;
  model: string | null;
  status: EventStatus;
  /** null = unknown. Never substitute 0 for an unknown count. */
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  /** Prompt-cache token counts (null/omitted = unknown). */
  cacheCreationTokens?: number | null;
  cacheReadTokens?: number | null;
  costAmount: number | null;
  costKind: "actual" | "estimated" | null;
  provenance: Provenance;
}

/** A monetary observation for a period. */
export interface CostObservation {
  type: "cost";
  connectionId: string;
  dedupeKey: string;
  periodStart: Date;
  periodEnd: Date;
  amount: number;
  kind: CostKind;
  provenance: Provenance;
  description?: string;
}

/** Provider-reported limit/remaining — only when legitimately available. */
export interface QuotaObservation {
  type: "quota";
  connectionId: string;
  dedupeKey: string;
  capturedAt: Date;
  limit: number | null;
  remaining: number | null;
  resetsAt: Date | null;
  provenance: Provenance;
}

/** Status of a connection, collector, or the local machine. */
export interface HealthObservation {
  type: "health";
  subjectType: "connection" | "collector" | "machine";
  subjectId: string;
  connectionId: string | null;
  capturedAt: Date;
  status: HealthStatus;
  provenance: Provenance;
  /** Safe, non-sensitive metrics only (numbers/labels — never content payloads). */
  metrics?: Record<string, number | string>;
}

export type Observation =
  | UsageObservation
  | CostObservation
  | QuotaObservation
  | HealthObservation;

/** Runtime information handed to a collector. Collectors get no database access. */
export interface CollectorContext {
  /** Current wall-clock time. Injected for determinism in tests. */
  now: Date;
  /** Target day for collection, formatted YYYY-MM-DD (local time). */
  targetDate: string;
  /** Display currency configured in settings (ISO code). */
  currency: string;
}

/** What a collector returns. Persistence outcome is reported separately by the service. */
export interface CollectorResult {
  observations: Observation[];
  /** Human-readable notes about what was (or could not be) collected. */
  notes?: string[];
}

export type CollectorMethod =
  | "internal-demo"
  | "official-api"
  | "local-file"
  | "local-process"
  | "manual-entry"
  | "import";

export interface Collector {
  id: string;
  name: string;
  description: string;
  method: CollectorMethod;
  /** Connection ids this collector produces observations for. */
  connectionIds: string[];
  /** Platforms with a real implementation; omitted = platform-independent. */
  platforms?: NodeJS.Platform[];
  /** Whether elevated/administrator privileges are required (must stay false). */
  requiresElevation?: boolean;
  /** Truthful implementation status. */
  status?: "implemented" | "planned";
  /**
   * Optional per-collector enable switch: name of a boolean app setting that
   * must be true for this collector to run (checked by the collector service).
   */
  enabledSettingKey?: "claudeCodeImportEnabled";
  /** Truthful statement of what this collector reads and never reads. */
  privacyNotes: string;
  collect(ctx: CollectorContext): Promise<CollectorResult>;
}

/** Static metadata a provider module declares. No live behavior in this milestone. */
export interface ProviderAdapterMetadata {
  providerId: string;
  providerName: string;
  category: "ai-model-provider" | "local-tool";
  websiteUrl?: string;
  connections: ConnectionDeclaration[];
}

export interface ConnectionDeclaration {
  connectionId: string;
  name: string;
  kind: ConnectionKind;
  collectionMethod: CollectionMethod;
  capabilities: CapabilityDeclaration[];
  /** What configuration a real integration would need (labels only — never values). */
  configurationRequirements: string[];
  privacyNotes: string;
  /** Names of future actions (not implemented in this milestone). */
  supportedActions: string[];
}
