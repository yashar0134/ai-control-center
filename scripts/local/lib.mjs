/**
 * Shared helpers for the local run scripts (setup / start / stop / status /
 * update). Pure decision logic lives here so it can be unit-tested without
 * touching real processes, ports, or files.
 *
 * Safety rules encoded here:
 *  - The app binds to 127.0.0.1 (localhost) only.
 *  - Stop only ever signals the exact PID recorded in our own state file,
 *    and only after confirming that PID is alive — never by process name,
 *    never "all node processes".
 *  - Backup filenames contain only a timestamp — no username, no paths.
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export const LOCALHOST = "127.0.0.1";
export const STATE_DIR = ".local-run";
export const STATE_FILE = "app-state.json";
export const DEFAULT_PORT = 3000;
export const PORT_ATTEMPTS = 10;

// ---------- pure helpers (unit-tested) ----------

/** Timestamp-only backup filename — never includes user or machine details. */
export function backupFileName(date) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `dev-backup-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.db`
  );
}

/** Parse + validate the state file payload; anything unexpected → null. */
export function parseStatePayload(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const { pid, port, startedAt } = raw;
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (typeof startedAt !== "string" || Number.isNaN(Date.parse(startedAt))) return null;
  return { pid, port, startedAt };
}

/**
 * Decide what "stop" should do. `isAlive(pid)` is injected for testability.
 * Returns one of:
 *  - { action: "not-running" }            no state recorded
 *  - { action: "clear-stale" }            state exists but that PID is gone
 *  - { action: "kill", pid }              signal exactly this recorded PID
 */
export function decideStopAction(state, isAlive) {
  if (!state) return { action: "not-running" };
  if (!isAlive(state.pid)) return { action: "clear-stale" };
  return { action: "kill", pid: state.pid };
}

/**
 * Choose the first free port starting at `preferred` (up to `attempts`).
 * `isFree(port)` is injected (async). Returns the port or null if none free.
 */
export async function choosePort(preferred, isFree, attempts = PORT_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    const candidate = preferred + i;
    if (candidate > 65535) break;
    if (await isFree(candidate)) return candidate;
  }
  return null;
}

/** Setup decisions: seed only a database that setup itself just created. */
export function decideSeed(dbExistedBeforeSetup) {
  return !dbExistedBeforeSetup;
}

// ---------- filesystem/network helpers (thin, not unit-tested) ----------

export function statePath(rootDir) {
  return path.join(rootDir, STATE_DIR, STATE_FILE);
}

export function readState(rootDir) {
  try {
    return parseStatePayload(fs.readFileSync(statePath(rootDir), "utf8"));
  } catch {
    return null;
  }
}

export function writeState(rootDir, state) {
  fs.mkdirSync(path.join(rootDir, STATE_DIR), { recursive: true });
  fs.writeFileSync(statePath(rootDir), JSON.stringify(state, null, 2));
}

export function clearState(rootDir) {
  try {
    fs.rmSync(statePath(rootDir));
  } catch {
    // Already gone — fine.
  }
}

/** True when a process with this PID exists (signal 0 = existence check). */
export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** True when nothing is listening on 127.0.0.1:port. */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, LOCALHOST);
  });
}

/** Best-effort HTTP reachability check with a short timeout. */
export async function httpReachable(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status > 0;
  } catch {
    return false;
  }
}

export function log(message) {
  console.log(message);
}

export function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}
