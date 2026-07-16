import { z } from "zod";

/**
 * Core domain vocabulary for AI Control Center.
 * SQLite stores these as strings; every boundary (collector output, server
 * actions, settings) validates against these Zod schemas.
 */

/** Where a value came from and how much it can be trusted. */
export const PROVENANCES = [
  "live",
  "locally-observed",
  "manual",
  "estimated",
  "demo",
  "stale",
  "unavailable",
  "unsupported",
] as const;
export const provenanceSchema = z.enum(PROVENANCES);
export type Provenance = z.infer<typeof provenanceSchema>;

/** What a connection can truthfully report. */
export const CAPABILITY_KEYS = [
  "usage",
  "model-attribution",
  "input-tokens",
  "output-tokens",
  "cost",
  "quota",
  "reset-time",
  "health",
  "actions",
] as const;
export const capabilityKeySchema = z.enum(CAPABILITY_KEYS);
export type CapabilityKey = z.infer<typeof capabilityKeySchema>;

export const CAPABILITY_STATES = [
  "available",
  "unavailable",
  "unsupported",
  "manual",
  "estimated",
  "planned",
] as const;
export const capabilityStateSchema = z.enum(CAPABILITY_STATES);
export type CapabilityState = z.infer<typeof capabilityStateSchema>;

export const capabilityDeclarationSchema = z.object({
  capability: capabilityKeySchema,
  state: capabilityStateSchema,
  note: z.string().max(300).optional(),
});
export type CapabilityDeclaration = z.infer<typeof capabilityDeclarationSchema>;

/** Connection lifecycle status shown to the user. */
export const CONNECTION_STATUSES = [
  "demo",
  "manual",
  "not-connected",
  "planned",
  "unavailable",
  "unsupported",
] as const;
export const connectionStatusSchema = z.enum(CONNECTION_STATUSES);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const CONNECTION_KINDS = ["subscription", "api", "local-tool"] as const;
export type ConnectionKind = (typeof CONNECTION_KINDS)[number];

export const COLLECTION_METHODS = [
  "demo-collector",
  "manual-entry",
  "none",
  "planned-official-api",
  "planned-local-file",
] as const;
export type CollectionMethod = (typeof COLLECTION_METHODS)[number];

export const COST_KINDS = ["actual", "estimated", "manual", "imported"] as const;
export const costKindSchema = z.enum(COST_KINDS);
export type CostKind = z.infer<typeof costKindSchema>;

export const EVENT_STATUSES = ["ok", "error", "unknown"] as const;
export const eventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const HEALTH_STATUSES = ["ok", "degraded", "down", "unknown"] as const;
export const healthStatusSchema = z.enum(HEALTH_STATUSES);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/**
 * Token counts: null means "unknown". A missing count must never be coerced
 * to zero — zero is a real measurement, null is the absence of one.
 */
export const tokenCountSchema = z.number().int().min(0).nullable();

/** True when a value is genuinely known (present), false when unknown. */
export function isKnown<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Compute total tokens only when it can be truthfully derived.
 * Returns null (unknown) unless an explicit total exists or both parts are known.
 */
export function deriveTotalTokens(
  input: number | null,
  output: number | null,
  explicitTotal?: number | null,
): number | null {
  if (isKnown(explicitTotal)) return explicitTotal;
  if (isKnown(input) && isKnown(output)) return input + output;
  return null;
}
