import type { AppIO } from '../io/index.ts';
import type { ChangeRoleInput, User } from '../types/user.ts';
import { organizationOf } from '../types/user.ts';
import { hasAtLeastRole } from '../utils/roles.ts';

export async function requireAuth(request: Request, io: AppIO): Promise<User> {
  const userId = await io.auth.getSessionUserId(request);
  if (!userId) throw new Error('UNAUTHORIZED');
  const user = await io.userRepo.getById(userId);
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export function assertCanManageOrg(actor: User, targetOrgId: string, requiredRole: import('../types/user.ts').UserRole = 'Admin') {
  if (actor.role === 'Superadmin') return;
  if (actor.organizationId !== targetOrgId) throw new Error('FORBIDDEN');
  if (!hasAtLeastRole(actor.role, requiredRole)) throw new Error('FORBIDDEN');
}

export async function listOrgUsersHandler(request: Request, orgId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  // If search query is provided
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  if (search) {
    return await io.userRepo.searchByName(orgId, search);
  }
  return await io.userRepo.listByOrganization(orgId);
}

export async function assignRoleHandler(request: Request, orgId: string, userId: string, body: ChangeRoleInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  // Optional: Prevent Admin from assigning Superadmin or modifying Superadmins
  const targetUser = await io.userRepo.getById(userId);
  if (!targetUser || organizationOf(targetUser) !== orgId) throw new Error('NOT_FOUND');
  if (actor.role !== 'Superadmin' && body.role === 'Superadmin') throw new Error('FORBIDDEN');

  const updated = await io.userRepo.update(userId, { role: body.role });
  if (!updated) throw new Error('NOT_FOUND');
  return updated;
}

export async function removeUserHandler(request: Request, orgId: string, userId: string, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const targetUser = await io.userRepo.getById(userId);
  if (!targetUser || organizationOf(targetUser) !== orgId) throw new Error('NOT_FOUND');

  return await io.userRepo.delete(userId);
}
