import { t, type Static } from 'elysia';

export const OrganizationSchema = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  description: t.Optional(t.String()),
  logo: t.Optional(t.String()),
  url: t.Optional(t.String()),
  colorScheme: t.Optional(t.String()),
  location: t.Optional(t.String()),
  latitude: t.Optional(t.Number()),
  longitude: t.Optional(t.Number()),
  shadowBanThreshold: t.Number({ default: 5 }),
  createdAt: t.String({ format: 'date-time' }),
  updatedAt: t.String({ format: 'date-time' })
});

export type Organization = Static<typeof OrganizationSchema>;

export const CreateOrganizationBody = t.Object({
  name: t.String(),
  slug: t.String(),
  description: t.Optional(t.String()),
  logo: t.Optional(t.String()),
  url: t.Optional(t.String()),
  colorScheme: t.Optional(t.String()),
  location: t.Optional(t.String()),
  latitude: t.Optional(t.Number()),
  longitude: t.Optional(t.Number()),
  shadowBanThreshold: t.Optional(t.Number())
});

export type CreateOrganizationInput = Static<typeof CreateOrganizationBody>;

export const UpdateOrganizationBody = t.Partial(CreateOrganizationBody);

export type UpdateOrganizationInput = Static<typeof UpdateOrganizationBody>;
