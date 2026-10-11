import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import * as schema from "./db/schema.ts";
import type { EmailSender } from "./io/index.ts";
import { verificationEmail } from "./emails/verification.ts";
import { passwordResetEmail } from "./emails/password-reset.ts";

export const MIN_PASSWORD_LENGTH = 8;

/** How long a password-reset link stays valid. */
export const PASSWORD_RESET_VALID_MINUTES = 60;

interface AuthConfig {
  db: any;
  emailSender: EmailSender;
  // Public URL of this API: the verification link points at GET /auth/verify-email
  apiUrl: string;
  /** Public URL of the frontend: the password-reset link opens its /redefinir-senha page. */
  appUrl: string;
  secret?: string;
  useSecureCookies?: boolean;
}

// Single better-auth configuration for production and tests
export function createAuth({ db, emailSender, apiUrl, appUrl, secret, useSecureCookies = false }: AuthConfig) {
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
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_VALID_MINUTES * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const link = `${appUrl.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(token)}`;
        await emailSender.send(passwordResetEmail({ email: user.email, name: user.name }, link, PASSWORD_RESET_VALID_MINUTES));
      }
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
