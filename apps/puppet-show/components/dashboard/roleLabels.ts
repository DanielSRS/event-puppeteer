/**
 * Portuguese names of the roles, shared by the user list and the audit trail.
 *
 * @module
 */

import { UserRoleSchema, type UserRole } from "@/lib/api/schemas";

/** Portuguese label of each role. */
export const ROLE_LABELS: Record<UserRole, string> = {
  Member: "Membro",
  Moderator: "Moderador",
  Admin: "Administrador",
  Superadmin: "Superadmin",
};

/** The label of `value` when it is a role the app knows, `null` otherwise. */
export function RoleLabel(value: unknown): string | null {
  const role = UserRoleSchema.safeParse(value);
  return role.success ? ROLE_LABELS[role.data] : null;
}
