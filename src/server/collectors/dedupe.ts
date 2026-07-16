import type { Observation } from "./contracts";

/**
 * Duplicate protection for collector output.
 *
 * SQLite (via Prisma) does not support `createMany({ skipDuplicates })`, so
 * de-duplication is an explicit, testable step: observations whose dedupe key
 * already exists in the database — or that repeat within one batch — are
 * skipped, and the skip count is reported on the collector run.
 */

export function observationDedupeKey(obs: Observation): string {
  if (obs.type === "health") {
    // Health snapshots are point-in-time by design; key by subject + capture time.
    return `health:${obs.subjectType}:${obs.subjectId}:${obs.capturedAt.toISOString()}`;
  }
  return `${obs.type}:${obs.dedupeKey}`;
}

export interface DedupeResult {
  fresh: Observation[];
  skipped: number;
}

/** Pure function: split observations into fresh vs already-known. */
export function splitFreshObservations(
  observations: Observation[],
  existingKeys: ReadonlySet<string>,
): DedupeResult {
  const seen = new Set<string>();
  const fresh: Observation[] = [];
  let skipped = 0;
  for (const obs of observations) {
    const key = observationDedupeKey(obs);
    if (existingKeys.has(key) || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    fresh.push(obs);
  }
  return { fresh, skipped };
}
