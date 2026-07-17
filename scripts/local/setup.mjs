/**
 * npm run setup:local
 *
 * One-command local installation:
 *   1. checks Node.js version,
 *   2. installs dependencies (only when missing),
 *   3. applies database migrations (never overwrites an existing database),
 *   4. seeds demo data ONLY into a brand-new database,
 *   5. creates the production build.
 *
 * Safe to run repeatedly. An existing prisma/dev.db is never deleted or
 * overwritten — migrations are applied additively.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { decideSeed, log, fail } from "./lib.mjs";

const root = process.cwd();
const isWindows = process.platform === "win32";

function run(title, command, args) {
  log(`\n▶ ${title}`);
  // Fixed internal commands only — nothing here is user-supplied. On Windows,
  // npm/npx are .cmd files, which require a shell; the command line is joined
  // from these fixed literals (never from user input).
  const result = isWindows
    ? spawnSync([command, ...args].join(" "), { cwd: root, stdio: "inherit", shell: true })
    : spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    fail(`Step failed: ${title}. Fix the error above and run "npm run setup:local" again.`);
  }
}

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  fail(`Node.js 20 or newer is required (you have ${process.versions.node}). Install it from https://nodejs.org and try again.`);
}

if (!fs.existsSync(path.join(root, "package.json"))) {
  fail('Run this from the ai-control-center folder (the one containing package.json).');
}

if (!fs.existsSync(path.join(root, "node_modules"))) {
  run("Installing dependencies (this can take a few minutes)", "npm", ["ci"]);
} else {
  log("✓ Dependencies already installed (delete node_modules to force a clean reinstall).");
}

const dbPath = path.join(root, "prisma", "dev.db");
const dbExistedBefore = fs.existsSync(dbPath);
log(dbExistedBefore
  ? "✓ Existing local database found — it will be kept, never overwritten."
  : "• No local database yet — it will be created now.");

run("Preparing the database", "npx", ["prisma", "migrate", "deploy"]);
run("Generating the database client", "npx", ["prisma", "generate"]);
// Keep connection/capability truth in sync with this version (user data untouched).
run("Syncing connection metadata", "npm", ["run", "db:sync"]);

if (decideSeed(dbExistedBefore)) {
  run("Adding labeled demo data to the new database", "npm", ["run", "db:seed"]);
} else {
  log("✓ Skipping demo seed — your existing data stays exactly as it is.");
}

run("Creating the production build", "npm", ["run", "build"]);

log(`
✅ Setup complete.

Next steps:
  Start the app:   npm run app:start
  Check status:    npm run app:status
  Stop the app:    npm run app:stop
  Update later:    npm run app:update
`);
