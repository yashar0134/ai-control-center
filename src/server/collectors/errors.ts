import { ZodError } from "zod";

/**
 * Safe collector error model.
 *
 * Collector failures are classified into a fixed set of categories. Only the
 * category and a hand-written safe message may reach the UI, CollectorRun, or
 * AuditEvent — never raw command output, stack traces, or OS error strings.
 */

export const COLLECTOR_ERROR_CATEGORIES = [
  "unsupported-platform",
  "collection-disabled",
  "timeout",
  "command-unavailable",
  "malformed-output",
  "permission-denied",
  "metric-unavailable",
  "internal-error",
] as const;

export type CollectorErrorCategory = (typeof COLLECTOR_ERROR_CATEGORIES)[number];

export class CollectorError extends Error {
  readonly category: CollectorErrorCategory;
  /** Human-readable, guaranteed free of sensitive detail. */
  readonly safeMessage: string;

  constructor(category: CollectorErrorCategory, safeMessage: string) {
    super(`${category}: ${safeMessage}`);
    this.name = "CollectorError";
    this.category = category;
    this.safeMessage = safeMessage;
  }
}

/** Map any thrown value to a CollectorError without leaking details. */
export function toCollectorError(err: unknown): CollectorError {
  if (err instanceof CollectorError) return err;
  if (err instanceof ZodError || err instanceof SyntaxError) {
    return new CollectorError(
      "malformed-output",
      "The system returned data in an unexpected format.",
    );
  }
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: string; killed?: boolean; signal?: string };
    if (e.code === "ENOENT") {
      return new CollectorError(
        "command-unavailable",
        "A required system command is not available on this machine.",
      );
    }
    if (e.code === "ETIMEDOUT" || e.killed === true || e.signal === "SIGTERM") {
      return new CollectorError(
        "timeout",
        "Collection took too long and was stopped.",
      );
    }
    if (e.code === "EACCES" || e.code === "EPERM") {
      return new CollectorError(
        "permission-denied",
        "The system denied access to a metric. No elevated permissions were requested.",
      );
    }
  }
  return new CollectorError(
    "internal-error",
    "Collection failed unexpectedly. Details were not recorded for privacy.",
  );
}

/** Reject a promise with a timeout CollectorError after `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new CollectorError("timeout", "Collection took too long and was stopped."),
        ),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
