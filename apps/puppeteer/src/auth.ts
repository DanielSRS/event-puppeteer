import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createInMemoryDatabase } from "./db/index.ts";
import { bearer } from "better-auth/plugins";

import * as schema from "./db/schema.ts";

export async function createTestAuth() {
  const testDb = await createInMemoryDatabase();
  return betterAuth({
    user: {
      additionalFields: {
        firstName: { type: "string", required: false },
        lastName: { type: "string", required: false },
        normalizedName: { type: "string", required: false },
        organizationId: { type: "string", required: false },
        role: { type: "string", required: false },
        isShadowBanned: { type: "boolean", required: false }
      }
    },
    database: drizzleAdapter(testDb, {
      provider: "pg",
      schema
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
