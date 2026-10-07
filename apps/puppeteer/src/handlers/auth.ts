import type { AppIO } from '../io/index.ts';
import type { RegisterInput, LoginInput, User } from '../types/user.ts';
import { normalizeName } from '../utils/normalize.ts';

export async function registerHandler(body: RegisterInput, orgId: string, io: AppIO) {
  const existing = await io.userRepo.getByEmail(body.email);
  if (existing) throw new Error('EMAIL_EXISTS');

  const { token, userId } = await io.auth.signUp(body.email, body.password, `${body.firstName} ${body.lastName}`);
  
  const user: User = {
    id: userId,
    firstName: body.firstName,
    lastName: body.lastName,
    normalizedName: normalizeName(`${body.firstName} ${body.lastName}`),
    email: body.email,
    organizationId: orgId,
    role: 'Member',
    isShadowBanned: false
  };

  await io.userRepo.create(user);
  return { user, token };
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
