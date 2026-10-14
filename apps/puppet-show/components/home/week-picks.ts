/**
 * What the top of the feed highlights: the events of the next seven days
 * (the "Próximos 7 dias" rail) and, among them, the most liked one (the
 * "Em destaque" hero). Pure helpers over {@link FeedCard}s.
 *
 * @module
 */

import { ApplyFeedView, type FeedCard } from "@/domain/feed";
import { DaysBetween, NextDay } from "@/domain/schedule";

/** How many days, today included, the rail and the hero look ahead. */
export const WEEK_DAYS = 7;

/** Whole days from `today` to the card's next day; `null` when it has none ahead. */
export function DaysAhead(card: FeedCard, today: string): number | null {
  const next = NextDay(card.schedule, today);
  return next === null ? null : DaysBetween(today, next.date);
}

/** Whether the card happens (again) within the next {@link WEEK_DAYS} days, today included. */
export function InNextWeek(card: FeedCard, today: string): boolean {
  const ahead = DaysAhead(card, today);
  return ahead !== null && ahead >= 0 && ahead < WEEK_DAYS;
}

/** The cards of the next seven days, soonest first. */
export function WeekCards(cards: readonly FeedCard[], today: string): FeedCard[] {
  return ApplyFeedView(cards.filter((card) => InNextWeek(card, today)), { filter: { kind: "soonest" }, query: "", today });
}

/** The most liked card of the next seven days (the first in the API's ranking on a tie); `null` when there is none. */
export function FeaturedCard(cards: readonly FeedCard[], today: string): FeedCard | null {
  let best: FeedCard | null = null;
  for (const card of cards) {
    if (InNextWeek(card, today) && (best === null || card.voteCount > best.voteCount)) best = card;
  }
  return best;
}

/** `"2026-10-14"` plus `days` → `"2026-10-20"`; the input itself when it isn't a `YYYY-MM-DD` date. */
export function AddDays(iso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) return iso;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days)).toISOString().slice(0, 10);
}
