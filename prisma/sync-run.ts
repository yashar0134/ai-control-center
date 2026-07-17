/** CLI entry for `npm run db:sync` — see sync.ts for what it does (and never does). */
import { PrismaClient } from "@prisma/client";
import { ensureDefaultSettings, syncRegistry } from "./sync";

const db = new PrismaClient();

async function main() {
  await syncRegistry(db);
  await ensureDefaultSettings(db);
  console.log("Registry sync complete (connections, capabilities, missing settings). User data untouched.");
}

main()
  .catch((e) => {
    console.error("Registry sync failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
