/**
 * npm run app:start
 *
 * Starts the production build bound to 127.0.0.1 (localhost ONLY — the app is
 * never exposed to the network), records the exact server PID in
 * .local-run/app-state.json, waits until the app answers, then opens the
 * browser. If the preferred port is busy, the next free port (up to +9) is
 * chosen automatically and printed.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, exec } from "node:child_process";
import {
  DEFAULT_PORT,
  LOCALHOST,
  STATE_DIR,
  choosePort,
  fail,
  httpReachable,
  isPortFree,
  isProcessAlive,
  log,
  readState,
  writeState,
} from "./lib.mjs";

const root = process.cwd();

const existing = readState(root);
if (existing && isProcessAlive(existing.pid)) {
  log(`The app is already running at http://${LOCALHOST}:${existing.port}`);
  log('Stop it first with "npm run app:stop" if you want to restart.');
  process.exit(0);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin) || !fs.existsSync(path.join(root, ".next", "BUILD_ID"))) {
  fail('The app is not set up yet. Run "npm run setup:local" first.');
}

const preferred = Number(process.env.PORT) || DEFAULT_PORT;
const port = await choosePort(preferred, isPortFree);
if (port === null) {
  fail(`Ports ${preferred}–${preferred + 9} are all in use. Close another app or set a different port, e.g.:  PORT=4000 npm run app:start`);
}
if (port !== preferred) {
  log(`Port ${preferred} is in use — using free port ${port} instead.`);
}

fs.mkdirSync(path.join(root, STATE_DIR), { recursive: true });
const logFile = path.join(root, STATE_DIR, "app.log");
const out = fs.openSync(logFile, "a");

// Spawn the Next.js server DIRECTLY with the current Node executable so the
// recorded PID is the real server process (no wrapper shells to guess at).
// All arguments are fixed strings; -H 127.0.0.1 keeps it localhost-only.
const child = spawn(
  process.execPath,
  [nextBin, "start", "-H", LOCALHOST, "-p", String(port)],
  { cwd: root, detached: true, stdio: ["ignore", out, out] },
);
child.unref();

writeState(root, {
  pid: child.pid,
  port,
  startedAt: new Date().toISOString(),
});

const url = `http://${LOCALHOST}:${port}`;
log(`Starting AI Control Center (PID ${child.pid})…`);

let ready = false;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  if (!isProcessAlive(child.pid)) break;
  if (await httpReachable(url)) {
    ready = true;
    break;
  }
}

if (!ready) {
  fail(`The app did not answer at ${url}. Check the log at ${path.join(STATE_DIR, "app.log")} and try "npm run setup:local" again.`);
}

log(`\n✅ Running at ${url}  (stop with "npm run app:stop")`);

// Open the default browser — fixed URL, localhost only.
const opener =
  process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
exec(opener, () => {
  // Browser failed to open? Not fatal — the URL is printed above.
});
