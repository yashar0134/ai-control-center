import { z } from "zod";
import {
  deriveTotalTokens,
  eventStatusSchema,
  healthStatusSchema,
  costKindSchema,
  provenanceSchema,
  tokenCountSchema,
} from "@/server/domain/types";
import type {
  CostObservation,
  HealthObservation,
  UsageObservation,
} from "./contracts";

/**
 * Normalization boundary between collector output and persistence.
 * Everything a collector reports is validated here before it can be written.
 * Unknown token counts stay null; totals are derived only when truthful.
 */

const usageObservationSchema = z.object({
  connectionId: z.string().min(1),
  dedupeKey: z.string().min(1),
  occurredAt: z.date(),
  eventType: z.string().min(1),
  model: z.string().min(1).nullable(),
  status: eventStatusSchema,
  inputTokens: tokenCountSchema,
  outputTokens: tokenCountSchema,
  totalTokens: tokenCountSchema,
  cacheCreationTokens: tokenCountSchema.optional(),
  cacheReadTokens: tokenCountSchema.optional(),
  costAmount: z.number().min(0).nullable(),
  costKind: z.enum(["actual", "estimated"]).nullable(),
  provenance: provenanceSchema,
});

export interface NormalizedUsageEvent {
  connectionId: string;
  dedupeKey: string;
  occurredAt: Date;
  eventType: string;
  model: string | null;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheCreationTokens: number | null;
  cacheReadTokens: number | null;
  costAmount: number | null;
  costKind: string | null;
  provenance: string;
}

export function normalizeUsageObservation(
  obs: UsageObservation,
): NormalizedUsageEvent {
  const parsed = usageObservationSchema.parse(obs);
  return {
    ...parsed,
    // Never invent totals: derived only from an explicit total or both parts.
    totalTokens: deriveTotalTokens(
      parsed.inputTokens,
      parsed.outputTokens,
      parsed.totalTokens,
    ),
    cacheCreationTokens: parsed.cacheCreationTokens ?? null,
    cacheReadTokens: parsed.cacheReadTokens ?? null,
  };
}

const costObservationSchema = z.object({
  connectionId: z.string().min(1),
  dedupeKey: z.string().min(1),
  periodStart: z.date(),
  periodEnd: z.date(),
  amount: z.number().min(0),
  kind: costKindSchema,
  provenance: provenanceSchema,
  description: z.string().max(300).optional(),
});

export function normalizeCostObservation(obs: CostObservation, currency: string) {
  const parsed = costObservationSchema.parse(obs);
  return { ...parsed, currency, description: parsed.description ?? null };
}

const healthObservationSchema = z.object({
  subjectType: z.enum(["connection", "collector", "machine"]),
  subjectId: z.string().min(1),
  connectionId: z.string().min(1).nullable(),
  capturedAt: z.date(),
  status: healthStatusSchema,
  provenance: provenanceSchema,
  metrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});

export function normalizeHealthObservation(obs: HealthObservation) {
  const parsed = healthObservationSchema.parse(obs);
  return {
    subjectType: parsed.subjectType,
    subjectId: parsed.subjectId,
    connectionId: parsed.connectionId,
    capturedAt: parsed.capturedAt,
    status: parsed.status,
    provenance: parsed.provenance,
    metricsJson: parsed.metrics ? JSON.stringify(parsed.metrics) : null,
  };
}
