import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createInMemoryDatabase } from "./db/index.ts";
import { bearer } from "better-auth/plugins";

export async function createTestAuth() {
  const testDb = await createInMemoryDatabase();
  return betterAuth({
    database: drizzleAdapter(testDb, {
      provider: "pg"
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 3
    },
    advanced: {
      useSecureCookies: false
    },
    plugins: [
      bearer()
    ]
  });
}

// We leave export const auth for now to not break any imports if they exist.
// We will initialize a dummy for now since we haven't configured the real Postgres DB string yet.
