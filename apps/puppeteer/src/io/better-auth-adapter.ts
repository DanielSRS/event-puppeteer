import type { AuthProvider, AuthSession } from './index.ts';

export class BetterAuthProvider implements AuthProvider {
  constructor(private authInstance: any) {}

  async signUp(email: string, password: string, name: string): Promise<AuthSession> {
    try {
      const data = await this.authInstance.api.signUpEmail({
        body: { email, password, name }
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
