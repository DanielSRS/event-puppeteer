import type { UserRole } from '../types/user.ts';

const ROLE_RANKS: Record<UserRole, number> = {
  Superadmin: 40,
  Admin: 30,
  Moderator: 20,
  Member: 10
};

export function hasAtLeastRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_RANKS[userRole] >= ROLE_RANKS[requiredRole];
}
