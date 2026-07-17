/**
 * npm run app:stop
 *
 * Stops ONLY the server this app started: it reads the PID recorded by
 * app:start, verifies that exact process is still alive, and signals it.
 * It never searches for processes by name and never touches anything else.
 */
import {
  clearState,
  decideStopAction,
  fail,
  isProcessAlive,
  log,
  readState,
} from "./lib.mjs";

const root = process.cwd();
const state = readState(root);
const decision = decideStopAction(state, isProcessAlive);

if (decision.action === "not-running") {
  log("The app is not running (no start record found).");
  process.exit(0);
}
if (decision.action === "clear-stale") {
  clearState(root);
  log("The app was not running anymore — cleaned up the stale start record.");
  process.exit(0);
}

try {
  process.kill(decision.pid); // SIGTERM to exactly the recorded PID
} catch {
  clearState(root);
  log("The recorded process was already gone — cleaned up.");
  process.exit(0);
}

// Wait up to 10 s for a clean shutdown.
let stopped = false;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (!isProcessAlive(decision.pid)) {
    stopped = true;
    break;
  }
}

if (!stopped) {
  fail(`The app (PID ${decision.pid}) did not stop within 10 seconds. Try again, or close it from Task Manager.`);
}

clearState(root);
log("✅ App stopped. Your data is safe in prisma/dev.db.");
