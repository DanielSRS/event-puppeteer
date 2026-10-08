/**
 * The public feed as people browse it: search, filter pills and orderings.
 *
 * The API already sends the feed ranked (votes + how soon each event happens)
 * and keeps only visible, upcoming events. Everything here is pure and works
 * on {@link FeedCard}s, the shape the cards draw.
 *
 * @module
 */

import { NextDay, SortedDays, type ScheduleDay } from "./schedule";

/** A public (system-defined) tag shown on a card. */
export type CardTag = { id: string; name: string };

/** One event as a feed card draws it. */
export type FeedCard = {
  id: string;
  title: string;
  description: string;
  location: string;
  /** Every day of the event, in calendar order. */
  schedule: ScheduleDay[];
  /** Public tags only, by name. */
  tags: CardTag[];
  /** Votes as the viewer should see them (server count plus the viewer's pending click, if any). */
  voteCount: number;
  /** Whether the viewer voted; always `false` for anonymous visitors. */
  voted: boolean;
  /** Whether the viewer created the event (they may delete it). */
  isOwn: boolean;
};

/** Which pill is selected. */
export type FeedFilter =
  /** Everything, in the API's ranking. */
  | { kind: "all" }
  /** Chronological: the soonest next day first. */
  | { kind: "soonest" }
  /** Most votes first. */
  | { kind: "most-liked" }
  /** Only events carrying this public tag. */
  | { kind: "tag"; tagId: string };

/** Everything that decides which cards are shown and in which order. */
export type FeedView = {
  filter: FeedFilter;
  /** Free text matched against title, description and location. */
  query: string;
  /** `YYYY-MM-DD`, used to find each event's next day. */
  today: string;
};

/** Lowercase without accents, so "palestra" finds "Palestra" and "ciencias" finds "Ciências". */
export function NormalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/**
 * Whether a card matches the search box. Every word typed must appear in the
 * title, the description or the location (in any order); an empty query matches all.
 */
export function MatchesQuery(card: FeedCard, query: string): boolean {
  const terms = NormalizeText(query).split(/\s+/).filter((term) => term.length > 0);
  if (terms.length === 0) return true;
  const haystack = NormalizeText(`${card.title} ${card.description} ${card.location}`);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Sort key for "Mais próximos": the next day (or the last day when all are
 * past, which the feed doesn't send) followed by its start time; all-day
 * entries sort before timed ones on the same date.
 */
function SoonestKey(card: FeedCard, today: string): string {
  const days = SortedDays(card.schedule);
  const next = NextDay(days, today);
  const day = next === null ? days[days.length - 1] : next;
  if (day === undefined) return "9999-12-31";
  return `${day.date} ${day.startTime === undefined ? "" : day.startTime}`;
}

/** The cards to show, in order, for the selected pill and search text. */
export function ApplyFeedView(cards: readonly FeedCard[], view: FeedView): FeedCard[] {
  const matching = cards.filter((card) => MatchesQuery(card, view.query));

  switch (view.filter.kind) {
    case "all":
      return matching;
    case "soonest":
      return [...matching].sort((a, b) => SoonestKey(a, view.today).localeCompare(SoonestKey(b, view.today)));
    case "most-liked":
      return [...matching].sort((a, b) => b.voteCount - a.voteCount);
    case "tag": {
      const { tagId } = view.filter;
      return matching.filter((card) => card.tags.some((tag) => tag.id === tagId));
    }
  }
}

/** One pill per public tag that at least one card carries, sorted by name. */
export function TagPills(cards: readonly FeedCard[]): CardTag[] {
  const byId = new Map<string, CardTag>();
  for (const card of cards) for (const tag of card.tags) byId.set(tag.id, tag);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Whether two filters are the same pill. */
export function SameFilter(a: FeedFilter, b: FeedFilter): boolean {
  if (a.kind === "tag" && b.kind === "tag") return a.tagId === b.tagId;
  return a.kind === b.kind;
}
