// Test-only helpers. Not imported by application code.
import type { InMemoryEmailSender } from './io/email/in-memory.ts';
import type { AppIO } from './io/index.ts';
import type { RegisterInput } from './types/user.ts';
import { registerHandler, verifyEmailHandler, loginHandler } from './handlers/auth.ts';

type TestIO = AppIO & { emailSender: InMemoryEmailSender };

// Token from the latest verification email sent to this address
export function verificationTokenFor(io: TestIO, email: string) {
  const message = io.emailSender.sent.findLast(m => m.to.email === email);
  const token = message?.text.match(/[?&]token=([^&\s]+)/)?.[1];
  if (!token) throw new Error(`No verification email sent to ${email}`);
  return decodeURIComponent(token);
}

// Registers through the real flow (email link opened, then login) and returns a session token
export async function registerVerified(body: RegisterInput, orgId: string, io: TestIO) {
  const { user } = await registerHandler(body, orgId, io);
  await verifyEmailHandler(verificationTokenFor(io, body.email), io);
  const { token } = await loginHandler({ email: body.email, password: body.password }, io);
  return { user, token };
}
