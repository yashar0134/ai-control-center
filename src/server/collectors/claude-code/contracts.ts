/**
 * Claude Code local usage source boundary.
 *
 * All filesystem access to Claude Code's local data goes through this narrow,
 * injectable interface. The real implementation (`real-source.ts`) reads the
 * local Claude Code data directory; tests inject synthetic fixtures and never
 * touch real user files.
 *
 * File references are opaque ids — absolute paths never cross this boundary,
 * are never persisted, and never reach the UI or logs.
 */

/** One candidate session-transcript file, identified by an opaque id. */
export interface ClaudeCodeSessionFile {
  /** Opaque id, meaningful only to the source that produced it. */
  id: string;
  sizeBytes: number;
  modifiedAt: Date;
}

/** Truthful detection result — no paths, no machine identifiers. */
export interface ClaudeCodeDetection {
  /** Claude Code's local data directory exists on this machine. */
  dataDirFound: boolean;
  /** Number of session-transcript files discovered (0 when none/undetected). */
  sessionFileCount: number;
}

export interface ClaudeCodeUsageSource {
  detect(): Promise<ClaudeCodeDetection>;
  listSessionFiles(): Promise<ClaudeCodeSessionFile[]>;
  /**
   * Stream the lines of one session file, reading at most `maxBytes`.
   * Lines beyond the byte cap are not produced.
   */
  readSessionLines(fileId: string, maxBytes: number): AsyncIterable<string>;
}
