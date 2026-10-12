import { t, type Static } from 'elysia';
import { ImageViewSchema } from './image.ts';

export const DayEntrySchema = t.Object({
  eventId: t.String(),
  date: t.String({ format: 'date' }), // e.g., '2023-10-01'
  startTime: t.Optional(t.String()), // e.g., '14:00'
  endTime: t.Optional(t.String()) // e.g., '16:00'
});
export type DayEntry = Static<typeof DayEntrySchema>;

export const EventTagSchema = t.Object({
  eventId: t.String(),
  tagId: t.String(),
  isFreeForm: t.Boolean()
});
export type EventTag = Static<typeof EventTagSchema>;

export const EventLinkSchema = t.Object({
  eventId: t.String(),
  labelId: t.String(),
  url: t.String({ format: 'uri' })
});
export type EventLink = Static<typeof EventLinkSchema>;

export const EventSchema = t.Object({
  id: t.String(),
  title: t.String(),
  description: t.String(),
  location: t.String(),
  latitude: t.Optional(t.Number()),
  longitude: t.Optional(t.Number()),
  creatorId: t.String(),
  organizationId: t.String(),
  isHidden: t.Boolean(),
  isDeleted: t.Boolean(),
  createdAt: t.String({ format: 'date-time' }),
  schedule: t.Array(DayEntrySchema),
  tags: t.Array(EventTagSchema),
  links: t.Array(EventLinkSchema)
});
export type Event = Static<typeof EventSchema>;

export const CreateEventBody = t.Object({
  title: t.String(),
  description: t.String(),
  location: t.String(),
  latitude: t.Optional(t.Number()),
  longitude: t.Optional(t.Number()),
  isHidden: t.Boolean(),
  schedule: t.Array(t.Object({
    date: t.String({ format: 'date' }),
    startTime: t.Optional(t.String()),
    endTime: t.Optional(t.String())
  }), { minItems: 1 }), // at least one day entry required
  tags: t.Array(t.Object({
    tagId: t.String(),
    isFreeForm: t.Boolean()
  })),
  links: t.Array(t.Object({
    labelId: t.String(),
    url: t.String({ format: 'uri' })
  }))
});
export type CreateEventInput = Static<typeof CreateEventBody>;

/**
 * An Event as one viewer sees it: with its banner Image resolved for that viewer
 * (absent when the Event never had a banner).
 */
export const EventViewSchema = t.Object({
  ...EventSchema.properties,
  banner: t.Optional(ImageViewSchema)
});
export type EventView = Static<typeof EventViewSchema>;

/** An Event opened by id, with its Vote count. */
export const EventWithVotesSchema = t.Object({
  ...EventViewSchema.properties,
  voteCount: t.Number()
});
export type EventWithVotes = Static<typeof EventWithVotesSchema>;

/**
 * An Event as shown in the kiosk feed, with its Vote count and computed weight.
 * A single flat object: response validation of a `t.Intersect` rejects the extra
 * `voteCount`/`weight` properties as unexpected.
 */
export const FeedEventSchema = t.Object({
  ...EventViewSchema.properties,
  voteCount: t.Number(),
  weight: t.Number()
});
export type FeedEvent = Static<typeof FeedEventSchema>;
