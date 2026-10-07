import { t, type Static } from 'elysia';

export const UserRoleSchema = t.Union([
  t.Literal('Superadmin'),
  t.Literal('Admin'),
  t.Literal('Moderator'),
  t.Literal('Member')
]);

export type UserRole = Static<typeof UserRoleSchema>;

export const UserSchema = t.Object({
  id: t.String(),
  firstName: t.String(),
  lastName: t.String(),
  normalizedName: t.String(),
  email: t.String({ format: 'email' }),
  organizationId: t.String(),
  role: UserRoleSchema,
  isShadowBanned: t.Boolean()
});

export type User = Static<typeof UserSchema>;

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
