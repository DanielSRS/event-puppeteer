import type { AppIO } from '../io/index.ts';
import type { RegisterInput, LoginInput, NewUser, User, ResendVerificationInput, RequestPasswordResetInput, ResetPasswordInput } from '../types/user.ts';
import { normalizeName } from '../utils/normalize.ts';
import { requireAuth } from './users.ts';

export async function registerHandler(body: RegisterInput, orgId: string, io: AppIO) {
  const existing = await io.userRepo.getByEmail(body.email);
  if (existing) throw new Error('EMAIL_EXISTS');
  // Checked up front: otherwise the auth insert fails on the foreign key with an opaque error
  if (!(await io.orgRepo.getById(orgId))) throw new Error('ORGANIZATION_NOT_FOUND');

  const newUser: NewUser = {
    firstName: body.firstName,
    lastName: body.lastName,
    normalizedName: normalizeName(`${body.firstName} ${body.lastName}`),
    email: body.email,
    organizationId: orgId,
    role: 'Member',
    isShadowBanned: false
  };
  const { userId } = await io.auth.signUp(body.password, newUser);
  // The account stays unusable until the link in this email is opened
  await io.auth.sendVerificationEmail(body.email);

  const user: User = { ...newUser, id: userId };
  return { user };
}

export async function verifyEmailHandler(token: string, io: AppIO) {
  return { verified: await io.auth.verifyEmail(token) };
}

export async function resendVerificationHandler(body: ResendVerificationInput, io: AppIO) {
  // Same answer whether or not the email exists or is already verified
  await io.auth.sendVerificationEmail(body.email);
  return { success: true as const };
}

/**
 * Logs in with email and password.
 * @throws INVALID_CREDENTIALS for a wrong email or password, and for a removed account
 * (its new session is ended at once).
 * @throws EMAIL_NOT_VERIFIED while the email is not confirmed.
 */
export async function loginHandler(body: LoginInput, io: AppIO) {
  const session = await io.auth.signIn(body.email, body.password);
  if (!(await io.userRepo.getById(session.userId))) {
    await io.auth.revokeAccess(session.userId);
    throw new Error('INVALID_CREDENTIALS');
  }
  return session;
}

/**
 * Emails a link to choose a new password. Answers the same whether or not the email
 * belongs to an account, so it can't be used to find accounts; removed accounts get
 * nothing.
 * @throws EMAIL_DELIVERY_FAILED when the email could not be sent.
 */
export async function requestPasswordResetHandler(body: RequestPasswordResetInput, io: AppIO) {
  const account = await io.userRepo.getByEmail(body.email);
  if (account && await io.userRepo.getById(account.id)) {
    await io.auth.sendPasswordResetEmail(body.email);
  }
  return { success: true as const };
}

/**
 * Sets a new password with the token from the emailed link. Ends every session of
 * the account; the link works once.
 * @throws INVALID_RESET_TOKEN when the token is unknown, expired, already used, or
 * belongs to a removed account.
 */
export async function resetPasswordHandler(body: ResetPasswordInput, io: AppIO) {
  const userId = await io.auth.userIdForResetToken(body.token);
  if (!userId || !(await io.userRepo.getById(userId))) throw new Error('INVALID_RESET_TOKEN');
  if (!(await io.auth.resetPassword(body.token, body.password))) throw new Error('INVALID_RESET_TOKEN');
  return { success: true as const };
}

/**
 * Returns the logged-in User.
 * @throws UNAUTHORIZED without a valid session, or when the User is unknown or removed.
 */
export async function meHandler(request: Request, io: AppIO) {
  return await requireAuth(request, io);
}
