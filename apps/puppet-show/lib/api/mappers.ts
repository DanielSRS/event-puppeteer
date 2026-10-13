/**
 * Turns API records into the shapes the public screens draw: feed cards, the
 * event details page and the TV display.
 *
 * Events only carry tag and link-label ids; the public catalogs
 * (`GET /tags`, `GET /link-labels`) give their names. Only system-defined tags
 * are public, so free-form ones never reach a public screen.
 *
 * @module
 */

import type { Event, FeedEvent, ImageView, LinkLabel, Tag } from "./schemas";
import type { CardTag, FeedCard } from "@/domain/feed";
import { ShownVoteFor, type PendingVote } from "@/domain/likes";
import { SortedDays, type ScheduleDay } from "@/domain/schedule";
import type { Coordinates } from "@/domain/links";

/** The event's public tags, by name, in the order the event lists them. */
export function PublicTags(event: Pick<Event, "tags">, catalog: readonly Tag[]): CardTag[] {
  const publicById = new Map(catalog.filter((tag) => tag.isSystemDefined).map((tag) => [tag.id, tag.name]));
  const tags: CardTag[] = [];
  for (const { tagId } of event.tags) {
    const name = publicById.get(tagId);
    if (name !== undefined) tags.push({ id: tagId, name });
  }
  return tags;
}

/** Only the date and times of each day, in calendar order. */
function Schedule(event: Pick<Event, "schedule">): ScheduleDay[] {
  return SortedDays(event.schedule).map(({ date, startTime, endTime }) => ({
    date,
    ...(startTime !== undefined ? { startTime } : {}),
    ...(endTime !== undefined ? { endTime } : {}),
  }));
}

/** What the viewer knows about their own relation to the feed. */
export type ViewerContext = {
  /** Logged-in user's id, `null` for anonymous visitors. */
  viewerId: string | null;
  /** Whether the viewer is a Superadmin, who may delete any event. */
  viewerIsSuperadmin: boolean;
  /** The viewer's confirmed vote for this event. */
  viewerVoted: boolean;
  /** The viewer's click not counted by the server yet, if any. */
  pending: PendingVote | undefined;
};

/** A feed event as a card, with the viewer's vote merged into the count. */
export function ToFeedCard(event: FeedEvent, catalog: readonly Tag[], viewer: ViewerContext): FeedCard {
  const vote = ShownVoteFor(event.voteCount, viewer.viewerVoted, viewer.pending);
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    schedule: Schedule(event),
    tags: PublicTags(event, catalog),
    voteCount: vote.count,
    voted: vote.voted,
    canDelete: viewer.viewerIsSuperadmin || (viewer.viewerId !== null && event.creatorId === viewer.viewerId),
  };
}

/** One external link of an event. */
export type DetailLink = {
  /** The label's name, e.g. "Inscrição"; `null` when the label isn't in the public catalog. */
  label: string | null;
  url: string;
};

/** An event as the details page draws it. */
export type EventDetail = {
  id: string;
  organizationId: string;
  creatorId: string;
  title: string;
  description: string;
  location: string;
  /** Present only when the event has both latitude and longitude. */
  coordinates: Coordinates | null;
  /** The banner as this viewer may see it; `null` when the event never had one. */
  banner: ImageView | null;
  isHidden: boolean;
  schedule: ScheduleDay[];
  tags: CardTag[];
  links: DetailLink[];
};

/** An event with its tag and link-label names resolved. */
export function ToEventDetail(event: Event, tags: readonly Tag[], labels: readonly LinkLabel[]): EventDetail {
  const labelNames = new Map(labels.map((label) => [label.id, label.name]));
  const coordinates = event.latitude !== undefined && event.longitude !== undefined
    ? { latitude: event.latitude, longitude: event.longitude }
    : null;

  return {
    id: event.id,
    organizationId: event.organizationId,
    creatorId: event.creatorId,
    title: event.title,
    description: event.description,
    location: event.location,
    coordinates,
    banner: event.banner === undefined ? null : event.banner,
    isHidden: event.isHidden,
    schedule: Schedule(event),
    tags: PublicTags(event, tags),
    links: event.links.map((link) => {
      const label = labelNames.get(link.labelId);
      return { label: label === undefined ? null : label, url: link.url };
    }),
  };
}

/** An event on the TV display. */
export type TvEvent = {
  id: string;
  title: string;
  location: string;
  schedule: ScheduleDay[];
  voteCount: number;
};

/** A feed event as the TV display draws it. */
export function ToTvEvent(event: FeedEvent): TvEvent {
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    schedule: Schedule(event),
    voteCount: event.voteCount,
  };
}
