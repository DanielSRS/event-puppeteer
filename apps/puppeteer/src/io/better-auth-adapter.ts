import type { AuthProvider, AuthSession } from './index.ts';
import type { NewUser } from '../types/user.ts';

export class BetterAuthProvider implements AuthProvider {
  constructor(private authInstance: any) {}

  async signUp(password: string, user: NewUser): Promise<AuthSession> {
    try {
      // App fields go in the same insert as better-auth's own (they are declared as
      // additionalFields), so the row satisfies the role/organization check from the start
      const data = await this.authInstance.api.signUpEmail({
        body: { ...user, password, name: `${user.firstName} ${user.lastName}` }
      });
      return {
        token: data.token,
        userId: data.user.id
      };
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
      throw new Error('Invalid credentials');
    }
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
