import type { SystemMetrics } from "./metrics";

/**
 * Fixed synthetic fixtures for the System page screenshot-preview mode.
 *
 * Purpose: the project README needs screenshots of the System page, but real
 * snapshots contain the contributor's actual machine statistics. This fixture
 * lets `/system?preview=demo` (development builds only) render a plausible,
 * fully synthetic snapshot instead.
 *
 * Guarantees:
 *  - values are hardcoded constants — nothing is measured or accepted as input
 *  - the UI labels every tile "demo" and shows a preview banner
 *  - nothing is ever written to the database in preview mode
 *  - production builds ignore the query parameter entirely
 */
export const SCREENSHOT_SYSTEM_METRICS: SystemMetrics = {
  osFamily: "windows",
  cpuPercent: 34.5,
  cpuCount: 12,
  memoryTotalBytes: 32 * 1024 ** 3,
  memoryUsedBytes: 19.6 * 1024 ** 3,
  memoryFreeBytes: 12.4 * 1024 ** 3,
  memoryPercent: 61.3,
  diskTotalBytes: 1024 * 1024 ** 3,
  diskUsedBytes: 583 * 1024 ** 3,
  diskFreeBytes: 441 * 1024 ** 3,
  diskPercent: 56.9,
  networkDownBytesPerSec: 3_437_500, // 27.5 Mbps
  networkUpBytesPerSec: 762_500, // 6.1 Mbps
  collectionDurationMs: 1280,
};

/** Fixed, obviously-synthetic capture time used only in preview mode. */
export const SCREENSHOT_CAPTURED_AT = new Date(2026, 0, 15, 9, 30, 0);
