/**
 * npm run app:status
 *
 * Reports whether the locally started app is running, on which localhost
 * port, since when, and whether it currently answers HTTP.
 */
import {
  LOCALHOST,
  httpReachable,
  isProcessAlive,
  log,
  readState,
} from "./lib.mjs";

const state = readState(process.cwd());

if (!state) {
  log('Status: not running (start it with "npm run app:start").');
  process.exit(0);
}

const alive = isProcessAlive(state.pid);
if (!alive) {
  log('Status: not running (a stale record exists — "npm run app:stop" cleans it up).');
  process.exit(0);
}

const url = `http://${LOCALHOST}:${state.port}`;
const answering = await httpReachable(url);
const startedAt = new Date(state.startedAt);
const upMinutes = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000));

log(`Status: running (PID ${state.pid})`);
log(`URL:    ${url}  (localhost only — not reachable from the network)`);
log(`Up:     ~${upMinutes} min (since ${startedAt.toLocaleString()})`);
log(`HTTP:   ${answering ? "answering" : "NOT answering — check .local-run/app.log"}`);
