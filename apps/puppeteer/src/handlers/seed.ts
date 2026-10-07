import type { AppIO } from '../io/index.ts';
import type { NewUser, RegisterInput, User } from '../types/user.ts';
import { normalizeName } from '../utils/normalize.ts';

// Bootstraps the first Superadmin: registration only ever creates Members, and only an
// Admin or Superadmin can change roles. Idempotent, so it is safe to run on every deploy.
export async function seedSuperadminHandler(input: RegisterInput, io: AppIO) {
  const existing = await io.userRepo.getByEmail(input.email);
  if (existing?.role === 'Superadmin') {
    return { status: 'unchanged' as const, user: existing };
  }
  if (existing) {
    await io.auth.markEmailVerified(input.email);
    const user = await io.userRepo.update(existing.id, { role: 'Superadmin' });
    if (!user) throw new Error('USER_NOT_FOUND');
    return { status: 'promoted' as const, user };
  }

  // Superadmins are system-wide: no organization
  const newUser: NewUser = {
    firstName: input.firstName,
    lastName: input.lastName,
    normalizedName: normalizeName(`${input.firstName} ${input.lastName}`),
    email: input.email,
    role: 'Superadmin',
    isShadowBanned: false
  };
  const { userId } = await io.auth.signUp(input.password, newUser);
  // Bootstrapped by the operator: no verification email, usable right away
  await io.auth.markEmailVerified(input.email);
  const user: User = { ...newUser, id: userId };
  return { status: 'created' as const, user };
}
