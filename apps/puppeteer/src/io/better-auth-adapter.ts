import type { AuthProvider, AuthSession } from './index.ts';
import type { NewUser } from '../types/user.ts';

export class BetterAuthProvider implements AuthProvider {
  constructor(private authInstance: any) {}

  async signUp(password: string, user: NewUser): Promise<{ userId: string }> {
    try {
      // App fields go in the same insert as better-auth's own (they are declared as
      // additionalFields), so the row satisfies the role/organization check from the start
      const data = await this.authInstance.api.signUpEmail({
        body: { ...user, password, name: `${user.firstName} ${user.lastName}` }
      });
      return { userId: data.user.id };
    } catch (e: any) {
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
      if (e?.body?.code === 'EMAIL_NOT_VERIFIED') throw new Error('EMAIL_NOT_VERIFIED');
      throw new Error('INVALID_CREDENTIALS');
    }
  }

  async sendVerificationEmail(email: string): Promise<void> {
    try {
      await this.authInstance.api.sendVerificationEmail({ body: { email } });
    } catch (e: any) {
      throw new Error('EMAIL_DELIVERY_FAILED: ' + e.message);
    }
  }

  async verifyEmail(token: string): Promise<boolean> {
    try {
      await this.authInstance.api.verifyEmail({ query: { token } });
      return true;
    } catch {
      return false;
    }
  }

  async markEmailVerified(email: string): Promise<void> {
    const context = await this.authInstance.$context;
    await context.internalAdapter.updateUserByEmail(email, { emailVerified: true });
  }

  async getSessionUserId(request: Request): Promise<string | null> {
    try {
      const session = await this.authInstance.api.getSession({
        headers: request.headers
      });
      if (!session) return null;
      return session.user.id;
    } catch {
      return null;
    }
  }
}
