import { t, type Static } from 'elysia';
import { ImageViewSchema } from './image.ts';

export const OrganizationSchema = t.Object({
  id: t.String(),
  name: t.String(),
  slug: t.String(),
  description: t.Optional(t.String()),
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

/**
 * An Organization as one viewer sees it: with its logo Image resolved for that viewer
 * (absent when the Organization never had a logo).
 */
export const OrganizationViewSchema = t.Object({
  ...OrganizationSchema.properties,
  logo: t.Optional(ImageViewSchema)
});
export type OrganizationView = Static<typeof OrganizationViewSchema>;

export const CreateOrganizationBody = t.Object({
  name: t.String(),
  slug: t.String(),
  description: t.Optional(t.String()),
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
