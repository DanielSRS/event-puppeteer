import type { AuthProvider, AuthSession } from './index.ts';
import type { NewUser } from '../types/user.ts';
import type { createAuth } from '../auth.ts';

// Better-auth errors carry status/body.code; anything else (DB, crypto, config) is unexpected.
// Logged so the real cause shows up in the server logs instead of a generic 401/400.
function describe(e: any) {
  const code = e?.body?.code ?? e?.code;
  const cause = e?.cause?.message ? ` (cause: ${e.cause.message})` : '';
  return `${e?.status ?? e?.name ?? 'Error'}${code ? ` ${code}` : ''}: ${e?.message ?? e}${cause}`;
}

const isExpected = (e: any, ...codes: string[]) => codes.includes(e?.body?.code);

export class BetterAuthProvider implements AuthProvider {
  constructor(private authInstance: ReturnType<typeof createAuth>) {}

  async signUp(password: string, user: NewUser): Promise<{ userId: string }> {
    try {
      // App fields go in the same insert as better-auth's own (they are declared as
      // additionalFields), so the row satisfies the role/organization check from the start
      const data = await this.authInstance.api.signUpEmail({
        body: { ...user, password, name: `${user.firstName} ${user.lastName}` }
      });
      return { userId: data.user.id };
    } catch (e: any) {
      console.error(`[auth] signUp ${user.email} failed → ${describe(e)}`, isExpected(e) ? '' : e?.stack ?? '');
      throw new Error('SIGNUP_FAILED: ' + e.message);
    }
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    try {
      const data = await this.authInstance.api.signInEmail({
        body: { email, password }
      });
      return {
        token: data.token,
        userId: data.user.id
      };
    } catch (e: any) {
      if (isExpected(e, 'INVALID_EMAIL_OR_PASSWORD', 'EMAIL_NOT_VERIFIED')) {
        console.warn(`[auth] signIn ${email} refused → ${describe(e)}`);
      } else {
        console.error(`[auth] signIn ${email} failed unexpectedly → ${describe(e)}`, e?.stack ?? '');
      }
      if (e?.body?.code === 'EMAIL_NOT_VERIFIED') throw new Error('EMAIL_NOT_VERIFIED');
      throw new Error('INVALID_CREDENTIALS');
    }
  }

  async sendVerificationEmail(email: string): Promise<void> {
    try {
      await this.authInstance.api.sendVerificationEmail({ body: { email } });
    } catch (e: any) {
      console.error(`[auth] sendVerificationEmail ${email} failed → ${describe(e)}`);
      throw new Error('EMAIL_DELIVERY_FAILED: ' + e.message);
    }
  }

  async verifyEmail(token: string): Promise<boolean> {
    try {
      await this.authInstance.api.verifyEmail({ query: { token } });
      return true;
    } catch (e: any) {
      console.warn(`[auth] verifyEmail refused → ${describe(e)}`);
      return false;
    }
  }

  async markEmailVerified(email: string): Promise<void> {
    const context = await this.authInstance.$context;
    await context.internalAdapter.updateUserByEmail(email, { emailVerified: true });
  }

  /**
   * Deletes the User's sessions (existing tokens stop working at once) and all their
   * accounts, credentials included (they can no longer log in). Errors propagate.
   */
  async revokeAccess(userId: string): Promise<void> {
    const context = await this.authInstance.$context;
    await context.internalAdapter.deleteUserSessions(userId);
    await context.internalAdapter.deleteAccounts(userId);
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await this.authInstance.api.requestPasswordReset({ body: { email } });
    } catch (e: unknown) {
      console.error(`[auth] requestPasswordReset ${email} failed → ${describe(e)}`);
      throw new Error('EMAIL_DELIVERY_FAILED: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  async userIdForResetToken(token: string): Promise<string | null> {
    const context = await this.authInstance.$context;
    const verification = await context.internalAdapter.findVerificationValue(`reset-password:${token}`);
    if (!verification || verification.expiresAt.getTime() <= Date.now()) return null;
    return verification.value;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      await this.authInstance.api.resetPassword({ body: { token, newPassword } });
      return true;
    } catch (e: unknown) {
      if (isExpected(e, 'INVALID_TOKEN')) {
        console.warn(`[auth] resetPassword refused → ${describe(e)}`);
        return false;
      }
      throw e;
    }
  }

  async getSessionUserId(request: Request): Promise<string | null> {
    try {
      const session = await this.authInstance.api.getSession({
        headers: request.headers
      });
      if (!session) return null;
      return session.user.id;
    } catch (e: any) {
      console.error(`[auth] getSession failed → ${describe(e)}`);
      return null;
    }
  }
}
