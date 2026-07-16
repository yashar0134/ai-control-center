import type { Collector } from "./contracts";
import { demoCollector } from "./demo/demo-collector";

/**
 * Typed registry of built-in collectors. Future collectors (Windows system
 * monitor, Claude Code local metadata, official API adapters) register here
 * at compile time. No runtime plugin loading.
 */
const COLLECTORS: readonly Collector[] = [demoCollector];

export function listCollectors(): readonly Collector[] {
  return COLLECTORS;
}

export function getCollector(id: string): Collector | undefined {
  return COLLECTORS.find((c) => c.id === id);
}
