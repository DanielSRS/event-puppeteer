import { t, type Static } from 'elysia';

export const UserRoleSchema = t.Union([
  t.Literal('Superadmin'),
  t.Literal('Admin'),
  t.Literal('Moderator'),
  t.Literal('Member')
]);

export type UserRole = Static<typeof UserRoleSchema>;

// Roles scoped to an Organization; Superadmin is system-wide
export const OrgRoleSchema = t.Union([
  t.Literal('Admin'),
  t.Literal('Moderator'),
  t.Literal('Member')
]);

const userFields = {
  id: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  normalizedName: t.String(),
  email: t.String({ format: 'email' }),
  isShadowBanned: t.Boolean()
};

// Discriminated by role: a Superadmin has no Organization, every other User has exactly one.
// The database enforces the same rule (user_role_organization check).
export const UserSchema = t.Union([
  t.Object({ ...userFields, role: t.Literal('Superadmin') }),
  t.Object({ ...userFields, role: OrgRoleSchema, organizationId: t.String() })
]);

export type User = Static<typeof UserSchema>;

export function organizationOf(user: User): string | undefined {
  return user.role === 'Superadmin' ? undefined : user.organizationId;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewUser = DistributiveOmit<User, 'id'>;

// Changing role to Superadmin drops the Organization (enforced by the repository)
export type UserUpdate = Partial<{
  firstName: string;
  lastName: string;
  normalizedName: string;
  role: UserRole;
  organizationId: string;
  isShadowBanned: boolean;
}>;

export const RegisterBody = t.Object({
  firstName: t.String(),
  lastName: t.String(),
  email: t.String({ format: 'email' }),
  password: t.String({ minLength: 8 })
});
export type RegisterInput = Static<typeof RegisterBody>;

export const LoginBody = t.Object({
  email: t.String({ format: 'email' }),
  password: t.String()
});
export type LoginInput = Static<typeof LoginBody>;

export const ChangeRoleBody = t.Object({
  role: UserRoleSchema
});
export type ChangeRoleInput = Static<typeof ChangeRoleBody>;
