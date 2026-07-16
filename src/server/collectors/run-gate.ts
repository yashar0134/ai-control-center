/**
 * In-process duplicate-run protection for collectors.
 *
 * This is a local, single-process application: a simple in-memory gate per
 * collector id is sufficient and honest (it is NOT a distributed lock).
 * It prevents overlapping runs and rapid repeat runs (cooldown).
 */
export type GateDecision =
  | { ok: true }
  | { ok: false; reason: "in-flight" | "cooldown" };

export class RunGate {
  private readonly inFlight = new Set<string>();
  private readonly lastFinishedAt = new Map<string, number>();

  constructor(
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryAcquire(key: string): GateDecision {
    if (this.inFlight.has(key)) return { ok: false, reason: "in-flight" };
    const last = this.lastFinishedAt.get(key);
    if (last !== undefined && this.now() - last < this.cooldownMs) {
      return { ok: false, reason: "cooldown" };
    }
    this.inFlight.add(key);
    return { ok: true };
  }

  release(key: string): void {
    this.inFlight.delete(key);
    this.lastFinishedAt.set(key, this.now());
  }
}
