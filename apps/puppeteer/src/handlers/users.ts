import { randomUUID } from 'node:crypto';
import type { AppIO } from '../io/index.ts';
import type { ChangeRoleInput, User } from '../types/user.ts';
import { organizationOf } from '../types/user.ts';
import { hasAtLeastRole } from '../utils/roles.ts';

/**
 * Resolves the logged-in User from the request's session.
 * @throws UNAUTHORIZED without a valid session, or when the User is unknown or removed
 * (checked even though removal also ends their sessions).
 */
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

/**
 * Changes the role of a User of an Organization. Admin of the Organization, or Superadmin.
 * Only a Superadmin may promote someone to Superadmin; the promoted User then leaves the
 * Organization (Superadmins are system-wide). An actual change is recorded in the audit
 * trail of the Organization as `change_role` with `{ from, to }`.
 * @throws FORBIDDEN when the actor may not manage the Organization, or a non-Superadmin
 * asks for Superadmin.
 * @throws NOT_FOUND when the User is unknown, removed or not in the Organization.
 */
export async function assignRoleHandler(request: Request, orgId: string, userId: string, body: ChangeRoleInput, io: AppIO) {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');

  const targetUser = await io.userRepo.getById(userId);
  if (!targetUser || organizationOf(targetUser) !== orgId) throw new Error('NOT_FOUND');
  if (actor.role !== 'Superadmin' && body.role === 'Superadmin') throw new Error('FORBIDDEN');

  const updated = await io.userRepo.update(userId, { role: body.role });
  if (!updated) throw new Error('NOT_FOUND');

  if (targetUser.role !== updated.role) {
    await io.auditRepo.create({
      id: randomUUID(),
      actorId: actor.id,
      organizationId: orgId,
      action: 'change_role',
      targetType: 'user',
      targetId: userId,
      details: { from: targetUser.role, to: updated.role },
      createdAt: new Date().toISOString()
    });
  }

  return updated;
}

/**
 * Removes a User from an Organization by deactivating them: the row is kept (the audit
 * trail, Votes, Reports and Device/Command references stay intact), their sessions and
 * credentials are revoked, their Events are soft-deleted, and a `remove_user` audit
 * entry records how many Events were deleted. Admin of the Organization, or Superadmin.
 * @throws UNAUTHORIZED without a valid session.
 * @throws FORBIDDEN when the actor may not manage the Organization.
 * @throws BAD_REQUEST when the actor tries to remove themselves.
 * @throws NOT_FOUND when the User is unknown, already removed, or not in the Organization.
 */
export async function removeUserHandler(request: Request, orgId: string, userId: string, io: AppIO): Promise<void> {
  const actor = await requireAuth(request, io);
  assertCanManageOrg(actor, orgId, 'Admin');
  if (userId === actor.id) throw new Error('BAD_REQUEST');

  const targetUser = await io.userRepo.getById(userId);
  if (!targetUser || organizationOf(targetUser) !== orgId) throw new Error('NOT_FOUND');

  const removedAt = new Date();
  await io.auth.revokeAccess(userId);
  const deletedEvents = await io.eventRepo.softDeleteByCreator(userId);
  if (!(await io.userRepo.markRemoved(userId, removedAt))) throw new Error('NOT_FOUND');

  await io.auditRepo.create({
    id: randomUUID(),
    actorId: actor.id,
    organizationId: orgId,
    action: 'remove_user',
    targetType: 'user',
    targetId: userId,
    details: { deletedEvents },
    createdAt: removedAt.toISOString()
  });
}
