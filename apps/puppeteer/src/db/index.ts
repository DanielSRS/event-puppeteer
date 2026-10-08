import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.ts";

/**
 * A Drizzle Postgres database over this schema, whatever the driver:
 * postgres-js in production, PGlite in tests.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let globalClient: PGlite | null = null;
let globalDb: PgliteDatabase<typeof schema> | null = null;

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
