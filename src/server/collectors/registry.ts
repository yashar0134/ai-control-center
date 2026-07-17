import type { Collector } from "./contracts";
import { demoCollector } from "./demo/demo-collector";
import { windowsSystemCollector } from "./system/windows-system-collector";
import { claudeCodeCollector } from "./claude-code/claude-code-collector";

/**
 * Typed registry of built-in collectors. Future collectors (official API
 * adapters) register here at compile time. No runtime plugin loading.
 */
const COLLECTORS: readonly Collector[] = [
  demoCollector,
  windowsSystemCollector,
  claudeCodeCollector,
];

export function listCollectors(): readonly Collector[] {
  return COLLECTORS;
}

export function getCollector(id: string): Collector | undefined {
  return COLLECTORS.find((c) => c.id === id);
}
