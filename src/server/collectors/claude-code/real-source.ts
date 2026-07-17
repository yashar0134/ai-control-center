import { createReadStream } from "node:fs";
import { lstat, readdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import os from "node:os";
import path from "node:path";
import type {
  ClaudeCodeDetection,
  ClaudeCodeSessionFile,
  ClaudeCodeUsageSource,
} from "./contracts";

/**
 * Real filesystem source for Claude Code local session transcripts.
 *
 * Claude Code stores one JSONL transcript per session under per-project
 * subdirectories of its local data directory. This source:
 *  - reads ONLY files whose names match the session-transcript pattern
 *    (`<uuid>.jsonl`) exactly one level below the projects directory;
 *  - refuses symlinked directories and files (no path escapes);
 *  - exposes files as opaque ids — absolute paths never leave this module;
 *  - streams lines with a hard byte cap per file.
 *
 * It never reads project files, credentials, settings, or anything outside
 * the allowlisted transcript files.
 */

const SESSION_FILE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/i;

/** Bounded directory scan — a data dir will never legitimately exceed these. */
const MAX_PROJECT_DIRS = 1000;
const MAX_FILES_PER_DIR = 5000;

function projectsRoot(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

async function safeDirEntries(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function isRealDirectory(p: string): Promise<boolean> {
  try {
    const st = await lstat(p); // lstat: a symlink is never followed
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

export class RealClaudeCodeSource implements ClaudeCodeUsageSource {
  /** Opaque file id → absolute path, valid for this instance only. */
  private fileMap = new Map<string, string>();

  async detect(): Promise<ClaudeCodeDetection> {
    const root = projectsRoot();
    if (!(await isRealDirectory(root))) {
      return { dataDirFound: false, sessionFileCount: 0 };
    }
    const files = await this.listSessionFiles();
    return { dataDirFound: true, sessionFileCount: files.length };
  }

  async listSessionFiles(): Promise<ClaudeCodeSessionFile[]> {
    const root = projectsRoot();
    const result: ClaudeCodeSessionFile[] = [];
    this.fileMap.clear();

    const dirNames = (await safeDirEntries(root)).slice(0, MAX_PROJECT_DIRS);
    let counter = 0;
    for (const dirName of dirNames) {
      const dirPath = path.join(root, dirName);
      if (!(await isRealDirectory(dirPath))) continue;

      const fileNames = (await safeDirEntries(dirPath)).slice(0, MAX_FILES_PER_DIR);
      for (const fileName of fileNames) {
        if (!SESSION_FILE_RE.test(fileName)) continue;
        const filePath = path.join(dirPath, fileName);
        try {
          const st = await lstat(filePath);
          if (!st.isFile() || st.isSymbolicLink()) continue;
          const id = `session-${counter++}`;
          this.fileMap.set(id, filePath);
          result.push({ id, sizeBytes: st.size, modifiedAt: st.mtime });
        } catch {
          // File disappeared or is unreadable — skip it, never crash the scan.
        }
      }
    }
    return result;
  }

  async *readSessionLines(fileId: string, maxBytes: number): AsyncIterable<string> {
    const filePath = this.fileMap.get(fileId);
    if (!filePath) return; // ids only come from our own listing

    const stream = createReadStream(filePath, {
      encoding: "utf8",
      start: 0,
      // The byte cap is enforced by the stream itself: nothing past it is read.
      end: Math.max(0, maxBytes - 1),
    });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        if (line.length > 0) yield line;
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  }
}

export const realClaudeCodeSource: ClaudeCodeUsageSource = new RealClaudeCodeSource();
