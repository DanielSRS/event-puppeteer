import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema.ts";

let globalClient: PGlite | null = null;
let globalDb: ReturnType<typeof drizzle> | null = null;

export async function createInMemoryDatabase() {
  if (globalDb) {
    // Clear data for the next test
    await globalClient!.exec(`
      TRUNCATE "session", "account", "user", "verification", "organization", "tag", "link_label", "event", "vote", "report", "audit", "device", "telemetry_heartbeat", "telemetry_log", "telemetry_data", "command" CASCADE;
    `);
    return globalDb;
  }

  globalClient = new PGlite();
  globalDb = drizzle({ client: globalClient, schema });
  
  // Run Drizzle migrations
  await migrate(globalDb, { migrationsFolder: "./src/db/migrations" });
  
  return globalDb;
}
