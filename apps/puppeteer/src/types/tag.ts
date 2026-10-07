import { t, type Static } from 'elysia';

export const TagSchema = t.Object({
  id: t.String(),
  name: t.String(),
  isSystemDefined: t.Boolean()
});
export type Tag = Static<typeof TagSchema>;

export const CreateTagBody = t.Object({
  name: t.String(),
  isSystemDefined: t.Boolean()
});
export type CreateTagInput = Static<typeof CreateTagBody>;

export const LinkLabelSchema = t.Object({
  id: t.String(),
  name: t.String()
});
export type LinkLabel = Static<typeof LinkLabelSchema>;

export const CreateLinkLabelBody = t.Object({
  name: t.String()
});
export type CreateLinkLabelInput = Static<typeof CreateLinkLabelBody>;
