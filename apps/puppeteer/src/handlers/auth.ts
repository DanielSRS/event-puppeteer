import type { AppIO } from '../io/index.ts';
import type { RegisterInput, LoginInput, NewUser, User, ResendVerificationInput } from '../types/user.ts';
import { normalizeName } from '../utils/normalize.ts';

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

export async function loginHandler(body: LoginInput, io: AppIO) {
  return await io.auth.signIn(body.email, body.password);
}

export async function meHandler(request: Request, io: AppIO) {
  const userId = await io.auth.getSessionUserId(request);
  if (!userId) throw new Error('UNAUTHORIZED');

  const user = await io.userRepo.getById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  return user;
}
