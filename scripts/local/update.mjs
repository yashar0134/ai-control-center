/**
 * npm run app:update
 *
 * Safely updates a local installation:
 *   1. refuses to run while the app is running,
 *   2. pulls the latest code (fast-forward only — no history rewriting),
 *   3. BACKS UP your database to prisma/backups/ BEFORE any migration,
 *   4. reinstalls dependencies, applies migrations, rebuilds.
 *
 * Your database is never deleted. If a migration fails, the original
 * database file is untouched on disk AND you have the timestamped backup;
 * exact restore instructions are printed on failure.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  backupFileName,
  fail,
  isProcessAlive,
  log,
  readState,
} from "./lib.mjs";

const root = process.cwd();
const isWindows = process.platform === "win32";

const state = readState(root);
if (state && isProcessAlive(state.pid)) {
  fail('The app is running. Stop it first with "npm run app:stop", then run the update again.');
}

function run(title, command, args, { rollbackHint } = {}) {
  log(`\n▶ ${title}`);
  // Fixed internal commands only; on Windows the shell is required for
  // npm/npx (.cmd files) and the command line is joined from fixed literals.
  const result = isWindows
    ? spawnSync([command, ...args].join(" "), { cwd: root, stdio: "inherit", shell: true })
    : spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    if (rollbackHint) log(rollbackHint);
    fail(`Step failed: ${title}.`);
  }
}

// 1. Pull the latest code (fast-forward only).
run("Getting the latest version", "git", ["pull", "--ff-only"]);

// 2. Back up the database BEFORE anything touches it.
const dbPath = path.join(root, "prisma", "dev.db");
let backupRelative = null;
if (fs.existsSync(dbPath)) {
  const backupsDir = path.join(root, "prisma", "backups");
  fs.mkdirSync(backupsDir, { recursive: true });
  const name = backupFileName(new Date());
  fs.copyFileSync(dbPath, path.join(backupsDir, name));
  backupRelative = path.join("prisma", "backups", name);
  log(`✓ Database backed up to ${backupRelative}`);
} else {
  log("• No database found yet — nothing to back up.");
}

// 3. Dependencies + migration + rebuild.
run("Updating dependencies", "npm", ["ci"]);

const rollbackHint = backupRelative
  ? `
⚠ The migration failed. Your data is safe:
   - the original prisma/dev.db was NOT deleted, and
   - a backup exists at ${backupRelative}.

To restore the backup (only if needed):
  1. Make sure the app is stopped.
  2. Copy ${backupRelative} over prisma/dev.db (File Explorer: copy + paste + rename, or:)
     copy "${backupRelative}" "prisma\\dev.db"
  3. Re-run: npm run app:update  (or ask for help in a GitHub issue)
`
  : undefined;

run("Applying database updates", "npx", ["prisma", "migrate", "deploy"], { rollbackHint });
run("Generating the database client", "npx", ["prisma", "generate"]);
// Keep connection/capability truth in sync with this version (user data untouched).
run("Syncing connection metadata", "npm", ["run", "db:sync"], { rollbackHint });
run("Rebuilding the app", "npm", ["run", "build"]);

log(`
✅ Update complete. Start the app again with:
  npm run app:start
`);
