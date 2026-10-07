import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import * as schema from "./db/schema.ts";
import type { EmailSender } from "./io/index.ts";
import { verificationEmail } from "./emails/verification.ts";

export const MIN_PASSWORD_LENGTH = 8;

interface AuthConfig {
  db: any;
  emailSender: EmailSender;
  // Public URL of this API: the verification link points at GET /auth/verify-email
  apiUrl: string;
  secret?: string;
  useSecureCookies?: boolean;
}

// Single better-auth configuration for production and tests
export function createAuth({ db, emailSender, apiUrl, secret, useSecureCookies = false }: AuthConfig) {
  return betterAuth({
    ...(secret ? { secret } : {}),
    baseURL: apiUrl,
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
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      requireEmailVerification: true
    },
    emailVerification: {
      // Sent explicitly by registerHandler / resend, so the seed can create a verified Superadmin silently
      sendOnSignUp: false,
      sendOnSignIn: false,
      sendVerificationEmail: async ({ user, token }) => {
        const link = `${apiUrl.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(token)}`;
        await emailSender.send(verificationEmail({ email: user.email, name: user.name }, link));
      }
    },
    advanced: { useSecureCookies },
    plugins: [bearer()]
  });
}
