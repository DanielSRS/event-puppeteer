import { t, type Static } from 'elysia';

export const VoteSchema = t.Object({
  userId: t.String(),
  eventId: t.String(),
  createdAt: t.String({ format: 'date-time' })
});

export type Vote = Static<typeof VoteSchema>;
